import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bold, Italic, Send } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

interface MessageComposerProps {
  channelId?: string;
  recipientId?: string;
  placeholder?: string;
  threadParentId?: string;
}

export function MessageComposer({ 
  channelId, 
  recipientId, 
  placeholder = "Type a message...",
  threadParentId 
}: MessageComposerProps) {
  const [content, setContent] = useState("");
  const { toast } = useToast();

  const sendMessageMutation = useMutation({
    mutationFn: async (messageContent: string) => {
      if (channelId) {
        return await apiRequest("POST", "/api/messages", {
          channelId,
          content: messageContent,
          threadParentId,
        });
      } else if (recipientId) {
        return await apiRequest("POST", "/api/direct-messages", {
          toUserId: recipientId,
          content: messageContent,
        });
      }
    },
    onSuccess: () => {
      if (channelId) {
        queryClient.invalidateQueries({ queryKey: ["/api/channels", channelId, "messages"] });
      } else if (recipientId) {
        queryClient.invalidateQueries({ queryKey: ["/api/direct-messages", recipientId] });
      }
      setContent("");
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    sendMessageMutation.mutate(content.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-border p-4">
      <div className="relative">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="min-h-20 resize-none pr-12 text-base"
          data-testid="input-message"
        />
        <div className="absolute bottom-2 right-2 flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="w-8 h-8 hover-elevate"
            data-testid="button-format-bold"
          >
            <Bold className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="w-8 h-8 hover-elevate"
            data-testid="button-format-italic"
          >
            <Italic className="w-4 h-4" />
          </Button>
          <Button
            type="submit"
            size="icon"
            disabled={!content.trim() || sendMessageMutation.isPending}
            className="w-8 h-8"
            data-testid="button-send-message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </form>
  );
}
