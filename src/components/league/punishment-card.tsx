import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { Punishment } from "@/lib/types/database";
import { Skull } from "lucide-react";

export function PunishmentCard({
  punishment,
  recipientName,
}: {
  punishment: Punishment | null;
  recipientName?: string;
}) {
  return (
    <Card variant="warning">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-400">
          <Skull className="h-4 w-4" />
          The Punishment
        </CardTitle>
      </CardHeader>
      {punishment ? (
        <div>
          <p className="text-lg font-medium text-amber-100">
            {punishment.description}
          </p>
          {recipientName && (
            <p className="mt-2 text-sm text-amber-400/80">
              {recipientName} is on the hook 👀
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">
          Admin hasn&apos;t set the punishment yet...
        </p>
      )}
    </Card>
  );
}
