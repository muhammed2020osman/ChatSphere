import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { insertTicketSchema } from "@shared/schema";

// Extend ticket schema for form validation
const ticketFormSchema = insertTicketSchema.extend({
  title: z.string().min(3, "العنوان يجب أن يكون 3 أحرف على الأقل"),
  description: z.string().optional(),
  disciplineId: z.string().min(1, "يجب اختيار الـ Discipline"),
  priority: z.enum(["low", "medium", "high"]),
  assignedTo: z.string().optional(),
});

type TicketFormValues = z.infer<typeof ticketFormSchema>;

interface CreateTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pinPosition: { x: number; y: number };
  drawingId: string;
  onSubmit: (ticket: TicketFormValues) => void;
}

// Mock data for disciplines and users
const disciplines = [
  { id: "1", name: "Architectural", code: "ARCH", icon: "📐" },
  { id: "2", name: "Structural", code: "STR", icon: "🏗️" },
  { id: "3", name: "MEP", code: "MEP", icon: "⚡" },
  { id: "4", name: "Annotations", code: "ANN", icon: "📝" },
];

const users = [
  { id: "1", name: "أحمد محمد", email: "ahmed@example.com" },
  { id: "2", name: "فاطمة علي", email: "fatima@example.com" },
  { id: "3", name: "محمد حسن", email: "mohamed@example.com" },
];

export function CreateTicketModal({
  open,
  onOpenChange,
  pinPosition,
  drawingId,
  onSubmit,
}: CreateTicketModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<TicketFormValues>({
    resolver: zodResolver(ticketFormSchema),
    defaultValues: {
      title: "",
      description: "",
      disciplineId: "",
      priority: "medium",
      assignedTo: "",
      drawingId,
      pinId: "", // Will be set after pin is created
      createdBy: "", // Will be set from current user
    },
  });

  const handleSubmit = async (values: TicketFormValues) => {
    setIsSubmitting(true);
    try {
      await onSubmit(values);
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create ticket:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]" data-testid="modal-create-ticket">
        <DialogHeader>
          <DialogTitle className="text-xl">إنشاء تذكرة جديدة</DialogTitle>
          <DialogDescription>
            إنشاء تذكرة مرتبطة بالدبوس عند الموقع ({Math.round(pinPosition.x)}, {Math.round(pinPosition.y)})
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>عنوان التذكرة *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="مثال: تعارض في الجدران"
                      data-testid="input-ticket-title"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الوصف</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="وصف تفصيلي للمشكلة أو الملاحظة..."
                      rows={4}
                      data-testid="textarea-ticket-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Discipline */}
            <FormField
              control={form.control}
              name="disciplineId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>التخصص (Discipline) *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    data-testid="select-discipline"
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر التخصص" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {disciplines.map((discipline) => (
                        <SelectItem
                          key={discipline.id}
                          value={discipline.id}
                          data-testid={`option-discipline-${discipline.code}`}
                        >
                          <span className="flex items-center gap-2">
                            <span>{discipline.icon}</span>
                            <span>{discipline.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Priority */}
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الأولوية</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    data-testid="select-priority"
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low" data-testid="option-priority-low">
                        منخفضة (Low)
                      </SelectItem>
                      <SelectItem value="medium" data-testid="option-priority-medium">
                        متوسطة (Medium)
                      </SelectItem>
                      <SelectItem value="high" data-testid="option-priority-high">
                        عالية (High)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Assigned To */}
            <FormField
              control={form.control}
              name="assignedTo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>تعيين إلى</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    data-testid="select-assigned-to"
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="اختياري - اختر مستخدم" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem
                          key={user.id}
                          value={user.id}
                          data-testid={`option-user-${user.id}`}
                        >
                          <div className="flex flex-col">
                            <span>{user.name}</span>
                            <span className="text-xs text-muted-foreground">{user.email}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Form Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                data-testid="button-cancel-ticket"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                data-testid="button-submit-ticket"
              >
                {isSubmitting ? "جارٍ الإنشاء..." : "إنشاء التذكرة"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
