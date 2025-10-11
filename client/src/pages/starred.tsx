import { Star } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function StarredPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Star className="w-6 h-6" />
            Starred
          </h1>
          <p className="text-muted-foreground mt-1">
            Important messages you've saved for later
          </p>
        </div>

        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Star className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">No starred messages yet</h3>
              <p className="text-sm text-muted-foreground">
                Star important messages to easily find them later
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
