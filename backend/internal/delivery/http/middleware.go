package httpdelivery

import (
	"context"
	"log"
	"net/http"
	"strings"
	"time"

	"backend/internal/domain"
	"backend/internal/usecase"
)

type ctxKey string

const ctxKeyClaims ctxKey = "claims"

// RequireAuth protects admin routes by validating the Bearer JWT and
// attaching its claims to the request context.
func RequireAuth(tm *TokenManager) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			parts := strings.SplitN(header, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				writeError(w, http.StatusUnauthorized, "missing or malformed authorization header")
				return
			}

			claims, err := tm.Parse(parts[1])
			if err != nil {
				writeError(w, http.StatusUnauthorized, "invalid or expired token")
				return
			}

			ctx := context.WithValue(r.Context(), ctxKeyClaims, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// ClaimsFromContext retrieves the JWT claims RequireAuth attached to the
// request context. Only call this from handlers mounted behind RequireAuth.
func ClaimsFromContext(ctx context.Context) (*Claims, bool) {
	claims, ok := ctx.Value(ctxKeyClaims).(*Claims)
	return claims, ok
}

// RequirePasswordChanged blocks mutating requests (anything but GET) until
// the caller has changed their default/admin-reset password. GET requests
// still pass through so the Dashboard can render its read-only data while
// the gate is up — matches the task's "show dashboard, block everything
// else until changed."
func RequirePasswordChanged(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := ClaimsFromContext(r.Context())
		if ok && claims.MustChangePassword && r.Method != http.MethodGet {
			writeErrorCode(w, http.StatusForbidden,
				"lazima ubadilishe nenosiri kabla ya kuendelea", "password_change_required")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// RequirePermission 403s unless the caller's role grants the given permission
// key. SuperAdmin always passes (see RoleUsecase.GetRolePermissionKeys), so
// it can never accidentally lock itself out by editing its own permissions.
// RequirePermission passes when the caller's role holds ANY of the listed
// permission keys. Nearly every route passes exactly one key; the variadic
// form exists for routes that legitimately serve two modules at once (e.g.
// product-image upload, reachable by media librarians and product editors
// alike).
func RequirePermission(roles *usecase.RoleUsecase, requiredKeys ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := ClaimsFromContext(r.Context())
			if !ok || claims.RoleID == nil {
				writeError(w, http.StatusForbidden, "you do not have permission to perform this action")
				return
			}

			keys, err := roles.GetRolePermissionKeys(r.Context(), *claims.RoleID, claims.BusinessID)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "failed to check permissions")
				return
			}

			for _, k := range keys {
				for _, required := range requiredKeys {
					if k == required {
						next.ServeHTTP(w, r)
						return
					}
				}
			}

			writeError(w, http.StatusForbidden, "you do not have permission to perform this action")
		})
	}
}

// RequireSuperAdmin 403s unless the caller's role is literally named
// "SuperAdmin" — a hard role-name check rather than a grantable permission
// key. Used for the audit log routes, which the task requires to be
// "STRICTLY" SuperAdmin-only; a permission key could be assigned to any
// other role from the Roles page, which would defeat that.
func RequireSuperAdmin(roles *usecase.RoleUsecase) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := ClaimsFromContext(r.Context())
			if !ok || !roles.IsSuperAdminRole(r.Context(), claims.RoleID, claims.BusinessID) {
				writeError(w, http.StatusForbidden, "this page is restricted to SuperAdmin")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// statusRecorder wraps http.ResponseWriter to capture the status code passed
// to WriteHeader — needed because ServeHTTP itself doesn't return one, and
// AuditLog needs to know it after the handler has already run.
type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (rec *statusRecorder) WriteHeader(status int) {
	rec.status = status
	rec.ResponseWriter.WriteHeader(status)
}

// clientIP resolves the real client address, preferring the leftmost entry
// of X-Forwarded-For when present. In production this app sits behind an
// Nginx reverse proxy (see Task 10), so r.RemoteAddr alone would always be
// Nginx's own address — making every audit log entry's IP useless. Safe to
// trust here specifically because the app is never reachable except through
// that proxy, which sets this header itself.
func clientIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		if ip := strings.TrimSpace(strings.SplitN(fwd, ",", 2)[0]); ip != "" {
			return ip
		}
	}
	return r.RemoteAddr
}

// AuditLog records every non-GET request that reaches it — every mutating
// admin action, gated or not (a 403 from RequirePermission still gets
// logged, since "user X tried to do Y without permission" is itself a
// meaningful audit event). Deliberately records metadata only (method, path,
// status, duration, caller, IP) and never request/response bodies, so a
// mistyped password can never end up in the audit trail. GET requests are
// skipped entirely — logging every list/view call would drown the "who did
// what" trail in routine read traffic.
func AuditLog(audit *usecase.AuditLogUsecase) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodGet {
				next.ServeHTTP(w, r)
				return
			}

			start := time.Now()
			rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(rec, r)
			duration := time.Since(start)

			log := &domain.AuditLog{
				Method:     r.Method,
				Path:       r.URL.Path,
				StatusCode: rec.status,
				DurationMs: int(duration.Milliseconds()),
				IPAddress:  clientIP(r),
			}
			if claims, ok := ClaimsFromContext(r.Context()); ok {
				log.UserID = &claims.UserID
				log.Username = claims.Username
				log.BusinessID = &claims.BusinessID
			}

			// Best-effort: a logging failure must never break the actual
			// request, which has already been served by this point.
			_ = audit.Record(r.Context(), log)
		})
	}
}

// Recoverer catches panics from any handler and turns them into a structured
// 500 JSON response (matching every other error path's {"error": "..."}
// shape) instead of crashing the connection or leaking a raw stack trace.
func Recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				log.Printf("panic recovered: %v", rec)
				writeError(w, http.StatusInternalServerError, "internal server error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// LimitBodySize wraps every request body in a size-limited reader as a
// blanket defense against oversized-payload memory-exhaustion attempts —
// every plain-JSON endpoint in this API (login, create/update requests,
// permission lists) is a few KB at most in legitimate use, so without any
// cap json.Decode would read an attacker-supplied body of unbounded size
// straight into memory. Deliberately reuses maxUploadSize (defined in
// upload_handler.go) rather than a smaller, JSON-specific constant: the
// upload routes call http.MaxBytesReader again with that same limit (see
// parseUploadForm), and MaxBytesReader has no way to raise a limit already
// set by an earlier wrap — only lower it — so a smaller global cap here
// would silently break legitimate image uploads.
func LimitBodySize(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)
		next.ServeHTTP(w, r)
	})
}

// NotFound is the mux's default handler for unmatched routes, kept
// consistent with the JSON error shape every other endpoint uses instead of
// Go's default plain-text "404 page not found".
func NotFound(w http.ResponseWriter, r *http.Request) {
	writeError(w, http.StatusNotFound, "route not found")
}

// CORS allows the configured frontend origin to call the API from the browser.
func CORS(allowedOrigin string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// SecurityHeaders sets a few standard, zero-cost response headers. This is a
// JSON API (no HTML templates to need a CSP for), so the set is
// deliberately small: nosniff stops a browser from ever reinterpreting an
// uploaded file's declared content-type, frame-options blocks this origin
// from being embedded in a clickjacking iframe, and the referrer policy
// avoids leaking full URLs (which can include resource IDs) to third-party
// referrers.
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		next.ServeHTTP(w, r)
	})
}
