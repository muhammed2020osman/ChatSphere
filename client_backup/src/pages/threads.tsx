import { useQuery } from "@tanstack/react-query";
import { MessagesSquare, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Message, User } from "@shared/schema";

interface ThreadMessage extends Message {
  user: User;
  replyCount: number;
  channel?: { id: string; name: string };
}

export default function ThreadsPage() {
  const { data: threads, isLoading } = useQuery<ThreadMessage[]>({
    queryKey: ["/api/messages/threads"],
  });

  const getUserInitials = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user.email?.[0]?.toUpperCase() || "?";
  };

  const getUserName = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.email || "Unknown";
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessagesSquare className="w-6 h-6" />
            Threads
          </h1>
          <p className="text-muted-foreground mt-1">
            Follow up on conversations you're part of
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
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : threads && threads.length > 0 ? (
          <div className="space-y-3">
            {threads.map((thread) => (
              <Link
                key={thread.id}
                href={`/channel/${thread.channelId}?thread=${thread.id}`}
              >
                <Card 
                  className="p-4 hover-elevate cursor-pointer"
                  data-testid={`thread-${thread.id}`}
                >
                  <div className="flex gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={thread.user.profileImageUrl || undefined} />
                      <AvatarFallback>
                        {getUserInitials(thread.user)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">
                          {getUserName(thread.user)}
                        </span>
                        {thread.channel && (
                          <span className="text-xs text-muted-foreground">
                            in #{thread.channel.name}
                          </span>
                        )}
                      </div>
                      <p className="text-sm line-clamp-2">
                        {thread.content}
                      </p>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MessageSquare className="w-3 h-3" />
                          <span>{thread.replyCount} {thread.replyCount === 1 ? 'reply' : 'replies'}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {thread.createdAt && formatDistanceToNow(new Date(thread.createdAt), { addSuffix: true })}
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
                <MessagesSquare className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">No threads yet</h3>
                <p className="text-sm text-muted-foreground">
                  When you participate in a thread, you'll see it here
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
