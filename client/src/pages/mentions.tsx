import { useQuery } from "@tanstack/react-query";
import { AtSign, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Notification, User } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { getUserInitials, getUserName } from "@/lib/utils";

export default function MentionsPage() {
  const { data: mentions, isLoading } = useQuery<any[]>({
    queryKey: ["/api/mentions"],
  });


  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AtSign className="w-6 h-6" />
            Mentions & reactions
          </h1>
          <p className="text-muted-foreground mt-1">
            Catch up on messages where you were mentioned
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4">
                <div className="flex gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : mentions && mentions.length > 0 ? (
          <div className="space-y-3">
            {mentions.map((mention: any) => (
              <Link
                key={mention.id}
                href={`/channel/${mention.channelId}?messageId=${mention.id}`}
              >
                <Card 
                  className="p-4 hover-elevate cursor-pointer transition-colors"
                  data-testid={`mention-${mention.id}`}
                >
                  <div className="flex gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={mention.user?.profileImageUrl || undefined} />
                      <AvatarFallback>
                        {mention.user && getUserInitials(mention.user)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">
                          {mention.user && getUserName(mention.user)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          mentioned you
                        </span>
                      </div>
                      <p className="text-sm line-clamp-2">
                        {mention.content}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <MessageSquare className="w-3 h-3" />
                        <span>
                          {mention.channel?.name && `#${mention.channel.name}`}
                        </span>
                        <span>•</span>
                        <span>
                          {mention.createdAt && formatDistanceToNow(new Date(mention.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <AtSign className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">No mentions yet</h3>
                <p className="text-sm text-muted-foreground">
                  When someone mentions you in a message, you'll see it here
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
