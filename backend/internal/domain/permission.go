package domain

import "github.com/google/uuid"

// Permission is a fixed, code-defined guardable capability (seeded via
// migration). Admins can't create permissions — only assign existing ones to
// roles.
type Permission struct {
	ID     uuid.UUID
	Module string
	Action string
	Key    string
}
