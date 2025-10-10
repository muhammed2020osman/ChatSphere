import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bold, Italic, Send, Paperclip, X } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { ObjectUploader } from "./ObjectUploader";
import type { UploadResult } from "@uppy/core";

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
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [attachmentType, setAttachmentType] = useState<string | null>(null);
  const { toast } = useToast();

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {};
      
      if (content.trim()) {
        payload.content = content.trim();
      }
      
      if (attachmentUrl) {
        payload.attachmentUrl = attachmentUrl;
        payload.attachmentName = attachmentName;
        payload.attachmentType = attachmentType;
      }

      if (channelId) {
        payload.channelId = channelId;
        payload.threadParentId = threadParentId;
        return await apiRequest("POST", "/api/messages", payload);
      } else if (recipientId) {
        payload.toUserId = recipientId;
        return await apiRequest("POST", "/api/direct-messages", payload);
      }
    },
    onSuccess: () => {
      if (channelId) {
        queryClient.invalidateQueries({ queryKey: ["/api/channels", channelId, "messages"] });
      } else if (recipientId) {
        queryClient.invalidateQueries({ queryKey: ["/api/direct-messages", recipientId] });
      }
      setContent("");
      setAttachmentUrl(null);
      setAttachmentName(null);
      setAttachmentType(null);
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
    if (!content.trim() && !attachmentUrl) return;
    sendMessageMutation.mutate();
  };

  const handleGetUploadParameters = async () => {
    const response = await apiRequest("POST", "/api/objects/upload") as unknown as { uploadURL: string };
    return {
      method: "PUT" as const,
      url: response.uploadURL,
    };
  };

  const handleUploadComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0) {
      const file = result.successful[0];
      const uploadURL = file.uploadURL;
      const fileName = file.name;
      const fileType = file.type;

      // Set ACL policy for the uploaded file
      const response = await apiRequest("PUT", "/api/attachments", {
        attachmentURL: uploadURL,
        fileName: fileName,
      }) as unknown as { objectPath: string };

      setAttachmentUrl(response.objectPath || null);
      setAttachmentName(fileName || null);
      setAttachmentType(fileType || "application/octet-stream");

      toast({
        title: "File attached",
        description: `${fileName} is ready to send`,
      });
    }
  };

  const removeAttachment = () => {
    setAttachmentUrl(null);
    setAttachmentName(null);
    setAttachmentType(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-border p-4">
      {attachmentUrl && (
        <div className="mb-2 flex items-center gap-2 p-2 bg-accent/50 rounded-md">
          <Paperclip className="w-4 h-4" />
          <span className="text-sm flex-1 truncate">{attachmentName}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="w-6 h-6"
            onClick={removeAttachment}
            data-testid="button-remove-attachment"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="min-h-20 resize-none text-base"
          data-testid="textarea-message-composer"
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <ObjectUploader
              maxNumberOfFiles={1}
              maxFileSize={10485760}
              onGetUploadParameters={handleGetUploadParameters}
              onComplete={handleUploadComplete}
              buttonVariant="ghost"
            >
              <Paperclip className="w-4 h-4" />
            </ObjectUploader>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              data-testid="button-format-bold"
            >
              <Bold className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              data-testid="button-format-italic"
            >
              <Italic className="w-4 h-4" />
            </Button>
          </div>
          <Button
            type="submit"
            size="icon"
            disabled={(!content.trim() && !attachmentUrl) || sendMessageMutation.isPending}
            data-testid="button-send-message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </form>
  );
}
