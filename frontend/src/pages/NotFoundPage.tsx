import { SearchX } from "lucide-react";
import { ErrorPage } from "../components/ErrorPage";

export function NotFoundPage() {
  return (
    <ErrorPage
      code="404"
      icon={<SearchX size={56} />}
      title="Ukurasa Haukupatikana"
      message="Samahani, ukurasa unaoutafuta haupo au umehamishwa. Hakikisha kiungo ni sahihi au rudi nyumbani."
    />
  );
}
