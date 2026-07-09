import { ShieldAlert } from "lucide-react";
import { ErrorPage } from "../components/ErrorPage";

export function ForbiddenPage() {
  return (
    <ErrorPage
      code="403"
      icon={<ShieldAlert size={56} />}
      title="Huna Ruhusa"
      message="Huna ruhusa ya kufikia ukurasa huu. Ikiwa unaamini hii ni kosa, wasiliana na msimamizi wa mfumo."
    />
  );
}
