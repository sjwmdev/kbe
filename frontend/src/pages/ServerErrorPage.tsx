import { ServerCrash } from "lucide-react";
import { ErrorPage } from "../components/ErrorPage";

interface ServerErrorPageProps {
  onRetry?: () => void;
}

export function ServerErrorPage({ onRetry }: ServerErrorPageProps) {
  return (
    <ErrorPage
      code="500"
      icon={<ServerCrash size={56} />}
      title="Hitilafu ya Mfumo"
      message="Samahani, kuna tatizo la kiufundi lililojitokeza. Tafadhali jaribu tena baada ya muda mfupi."
      actionLabel={onRetry ? "Jaribu Tena" : "Rudi Nyumbani"}
      onAction={onRetry}
    />
  );
}
