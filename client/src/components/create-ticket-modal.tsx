import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
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
import { insertTicketSchema, type Discipline, type User, type Layer } from "@shared/schema";

// Extend ticket schema for form validation
// Remove pinId and drawingId - these are set by the parent component
const ticketFormSchema = insertTicketSchema
  .omit({ pinId: true, drawingId: true })
  .extend({
    title: z.string().min(3, "العنوان يجب أن يكون 3 أحرف على الأقل"),
    description: z.string().optional(),
    type: z.enum(["rfi", "issue", "clash", "change_request", "observation", "safety", "quality"]),
    disciplineId: z.string().min(1, "يجب اختيار الـ Discipline"),
    priority: z.enum(["low", "medium", "high"]),
    assignedTo: z.string().optional(),
    layerId: z.string().optional(), // Layer is optional - some drawings don't have layers
  });

type TicketFormValues = z.infer<typeof ticketFormSchema>;

interface CreateTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pinPosition: { x: number; y: number };
  drawingId: string;
  drawingDisciplineId?: string; // Auto-populate discipline from drawing
  layers: Layer[];
  onSubmit: (ticket: TicketFormValues) => void;
}

export function CreateTicketModal({
  open,
  onOpenChange,
  pinPosition,
  drawingId,
  drawingDisciplineId,
  layers,
  onSubmit,
}: CreateTicketModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch disciplines and users from API
  const { data: disciplines = [] } = useQuery<Discipline[]>({
    queryKey: ['/api/disciplines'],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const form = useForm<TicketFormValues>({
    resolver: zodResolver(ticketFormSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "issue",
      disciplineId: drawingDisciplineId || "", // Auto-populate from drawing
      priority: "medium",
      assignedTo: "",
      layerId: "",
    },
  });

  // Auto-populate discipline when drawingDisciplineId changes
  useEffect(() => {
    if (drawingDisciplineId) {
      form.setValue("disciplineId", drawingDisciplineId);
    }
  }, [drawingDisciplineId, form]);

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
            {/* Ticket Type - FIRST as requested */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>نوع التذكرة *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    data-testid="select-ticket-type"
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر نوع التذكرة" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="rfi" data-testid="option-type-rfi">
                        RFI - طلب معلومات
                      </SelectItem>
                      <SelectItem value="issue" data-testid="option-type-issue">
                        مشكلة فنية (Issue)
                      </SelectItem>
                      <SelectItem value="clash" data-testid="option-type-clash">
                        تعارض (Clash)
                      </SelectItem>
                      <SelectItem value="change_request" data-testid="option-type-change-request">
                        طلب تغيير (Change Request)
                      </SelectItem>
                      <SelectItem value="observation" data-testid="option-type-observation">
                        ملاحظة (Observation)
                      </SelectItem>
                      <SelectItem value="safety" data-testid="option-type-safety">
                        سلامة (Safety)
                      </SelectItem>
                      <SelectItem value="quality" data-testid="option-type-quality">
                        جودة (Quality)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Title - SECOND */}
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

            {/* Description - THIRD */}
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

            {/* Layer - FOURTH (OPTIONAL - No asterisk) */}
            <FormField
              control={form.control}
              name="layerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الطبقة (Layer)</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    data-testid="select-layer"
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="اختياري - اختر الطبقة" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {layers.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          لا توجد طبقات متاحة
                        </div>
                      ) : (
                        layers.map((layer) => {
                          const discipline = disciplines.find(d => d.id === layer.disciplineId);
                          return (
                            <SelectItem
                              key={layer.id}
                              value={layer.id}
                              data-testid={`option-layer-${layer.id}`}
                            >
                              {layer.name} ({discipline?.name || 'Unknown'})
                            </SelectItem>
                          );
                        })
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Discipline - FIFTH (auto-filled from drawing) */}
            <FormField
              control={form.control}
              name="disciplineId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>التخصص (Discipline) *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
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
                          data-testid={`option-discipline-${discipline.name || 'N/A'}`}
                        >
                          {discipline.name}
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
                      {users.map((user) => {
                        const displayName = user.name || user.email;
                        
                        return (
                          <SelectItem
                            key={user.id}
                            value={user.id}
                            data-testid={`option-user-${user.id}`}
                          >
                            <div className="flex flex-col">
                              <span>{displayName}</span>
                              {user.name && user.email && (
                                <span className="text-xs text-muted-foreground">{user.email}</span>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })}
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
