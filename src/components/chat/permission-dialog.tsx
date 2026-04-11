import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";

interface PermissionRequest {
  requestId: string;
  sessionId: string;
  description: string;
  options: Array<{
    id: string;
    label: string;
    kind: string;
  }>;
}

interface PermissionDialogProps {
  request: PermissionRequest | null;
  onRespond: (requestId: string, optionId: string) => void;
}

export function PermissionDialog({
  request,
  onRespond,
}: PermissionDialogProps) {
  if (!request) return null;

  return createPortal(
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-xl border border-border bg-background shadow-2xl">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="flex size-8 items-center justify-center rounded-full bg-yellow-500/10">
            <Shield className="size-4 text-yellow-600" />
          </div>
          <h3 className="font-semibold">Permission Request</h3>
        </div>

        <div className="px-5 py-4">
          <p className="text-sm text-foreground">{request.description}</p>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          {request.options.map((option) => (
            <Button
              key={option.id}
              variant={option.kind === "deny" ? "outline" : "default"}
              size="sm"
              onClick={() => onRespond(request.requestId, option.id)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
    </div>,
    document.getElementById("app-container")!,
  );
}
