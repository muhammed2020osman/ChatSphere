"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
// import type { Discipline, Floor } from "@shared/schema";

const uploadDrawingSchema = z.object({
  sheetNo: z.string().min(1, "Drawing number is required"),
  title: z.string().min(1, "Title is required"),
  disciplineId: z.string().min(1, "Discipline is required"),
  floorId: z.string().optional(),
  packageName: z.string().optional(),
  revisionNo: z.string().min(1, "Revision number is required"),
  file: z.instanceof(File, { message: "Please select a file" }),
});

type UploadDrawingForm = z.infer<typeof uploadDrawingSchema>;

interface UploadDrawingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UploadDrawingDialog({ open, onOpenChange }: UploadDrawingDialogProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  const { data: disciplines } = useQuery<any[]>({
    queryKey: ["/api/disciplines"],
  });

  const { data: floors } = useQuery<any[]>({
    queryKey: ["/api/floors"],
  });

  const form = useForm<UploadDrawingForm>({
    resolver: zodResolver(uploadDrawingSchema),
    defaultValues: {
      sheetNo: "",
      title: "",
      disciplineId: "",
      floorId: undefined,
      packageName: "",
      revisionNo: "A",
      file: undefined,
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: UploadDrawingForm) => {
      setIsUploading(true);

      try {
        // Create FormData for file upload
        const formData = new FormData();
        formData.append('file', data.file);

        // Upload file directly to the server
        const uploadResponse = await apiRequest<{ 
          success: boolean; 
          fileUrl: string; 
          fileName: string; 
          fileSize: number; 
          mimeType: string 
        }>("/api/upload", {
          method: "PUT",
          body: formData,
        });

        const fileUrl = uploadResponse.fileUrl;

        // Create drawing
        const drawing = await apiRequest<{ id: string }>("/api/drawings", {
          method: "POST",
          body: {
            name: data.title,
            description: "",
            data: {
              sheetNo: data.sheetNo,
              title: data.title,
              disciplineId: data.disciplineId,
              floorId: data.floorId,
              packageName: data.packageName,
            },
          },
        });

        // Create first revision
        await apiRequest(`/api/drawings/${drawing.id}/revisions`, {
          method: "POST",
          body: {
            version: data.revisionNo,
            changes: {
              fileUrl,
              fileName: data.file.name,
              fileType: data.file.type,
              fileSize: data.file.size.toString(),
              status: "draft",
            },
          },
        });

        return drawing;
      } finally {
        setIsUploading(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drawings"] });
      toast({
        title: "Success",
        description: "Drawing uploaded successfully",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload drawing",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: UploadDrawingForm) => {
    uploadMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-upload-drawing">
        <DialogHeader>
          <DialogTitle>Upload New Drawing</DialogTitle>
          <DialogDescription>
            Upload a new engineering drawing with its first revision
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sheetNo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Drawing Number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., A-101"
                        {...field}
                        data-testid="input-sheet-no"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="revisionNo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Revision Number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., A"
                        {...field}
                        data-testid="input-revision-no"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Ground Floor Plan"
                      {...field}
                      data-testid="input-title"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="disciplineId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discipline</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      data-testid="select-discipline"
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select discipline" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {disciplines?.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name || 'N/A'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="floorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Floor (Optional)</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      data-testid="select-floor"
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select floor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {floors?.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="packageName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Package Name (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Core and Shell"
                      {...field}
                      data-testid="input-package-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="file"
              render={({ field: { value, onChange, ...field } }) => (
                <FormItem>
                  <FormLabel>PDF File</FormLabel>
                  <FormControl>
                    <Input
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onChange(file);
                      }}
                      data-testid="input-file"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isUploading}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isUploading}
                data-testid="button-submit-upload"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Drawing
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
