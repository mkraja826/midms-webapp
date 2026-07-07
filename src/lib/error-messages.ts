import { Alert } from "react-native";

type AlertButton = Parameters<typeof Alert.alert>[2];
type AlertOptions = Parameters<typeof Alert.alert>[3];

let installed = false;

const GENERIC_RETRY_MESSAGE =
  "Something went wrong. Please try again. If it continues, contact support.";

const TECHNICAL_PATTERNS = [
  /PGRST\d+/i,
  /SQLSTATE/i,
  /violates row-level security/i,
  /row-level security/i,
  /Could not find the function/i,
  /function .* does not exist/i,
  /schema cache/i,
  /JWT/i,
  /Supabase/i,
  /PostgREST/i,
  /permission denied/i,
  /duplicate key/i,
  /foreign key/i,
  /storage\/v1/i,
  /requested path is invalid/i,
  /invalid input syntax/i,
  /Details:/i,
  /Hint:/i,
  /Code:/i,
];

function isTechnicalMessage(message: string) {
  return TECHNICAL_PATTERNS.some((pattern) => pattern.test(message));
}

function titleText(title?: string) {
  return String(title || "").toLowerCase();
}

function friendlyByContext(title?: string, message?: string) {
  const context = `${titleText(title)} ${String(message || "").toLowerCase()}`;

  if (context.includes("login")) {
    return "Login failed. Check the email, password and internet connection, then try again.";
  }

  if (context.includes("signup") || context.includes("clinic setup") || context.includes("join")) {
    return "Setup could not be completed. Please check the details and try again. If it continues, contact support.";
  }

  if (context.includes("upload") || context.includes("file") || context.includes("gallery") || context.includes("image")) {
    return "File could not be opened or uploaded. Please check internet and try again. If it continues, contact support.";
  }

  if (context.includes("payment") || context.includes("invoice") || context.includes("pending")) {
    return "Payment could not be updated. Please refresh and try again. If it continues, contact support.";
  }

  if (context.includes("appointment") || context.includes("reminder") || context.includes("follow-up")) {
    return "Reminder or appointment could not be updated. Please refresh and try again.";
  }

  if (context.includes("dashboard") || context.includes("load")) {
    return "Data could not be loaded. Please check internet and refresh.";
  }

  if (context.includes("delete")) {
    return "This item could not be deleted. Please refresh and try again.";
  }

  if (context.includes("logout")) {
    return "Logout failed. Please close and reopen the app, then try again.";
  }

  return GENERIC_RETRY_MESSAGE;
}

export function getFriendlyErrorMessage(error: unknown, title?: string) {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : typeof error === "object" && error && "message" in error
          ? String((error as { message?: unknown }).message)
          : "";

  if (!raw) return friendlyByContext(title);

  if (isTechnicalMessage(raw) || raw.length > 150 || raw.includes("\n")) {
    return friendlyByContext(title, raw);
  }

  if (/network/i.test(raw) || /timed out/i.test(raw) || /timeout/i.test(raw)) {
    return "Network is slow or unavailable. Please check internet and try again.";
  }

  return raw;
}

export function installFriendlyAlertFilter() {
  if (installed) return;
  installed = true;

  const originalAlert = Alert.alert.bind(Alert);

  Alert.alert = (
    title: string,
    message?: string,
    buttons?: AlertButton,
    options?: AlertOptions
  ) => {
    const safeMessage =
      typeof message === "string" ? getFriendlyErrorMessage(message, title) : message;

    return originalAlert(title, safeMessage, buttons, options);
  };
}
