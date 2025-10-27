"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, AlertCircle, CheckCircle2, FileText, X, ImageIcon, Bot, FileSearch } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Discipline, Floor, DrawingWithDetails } from "@/shared/schema";

type Step = "selection" | "upload" | "review" | "processing" | "success" | "manual_form";

interface DrawingFormData {
  sheetNo: string;
  title: string;
  buildingId: number;
  floorId: number;
  disciplineId: number;
}

// Manual upload form schema
const manualUploadSchema = z.object({
  file: z.instanceof(File, { message: "يرجى اختيار ملف PDF" })
    .refine((file) => file.type === "application/pdf", {
      message: "يجب أن يكون الملف بصيغة PDF فقط",
    }),
  sheetNo: z.string().min(1, "رقم اللوحة مطلوب"),
  title: z.string().min(1, "اسم المخطط مطلوب"),
  disciplineId: z.string().min(1, "التخصص مطلوب"),
  floorId: z.string().optional(),
  versionType: z.enum(["new", "update"]).default("new"),
  parentDrawingId: z.string().optional(),
  revisionNotes: z.string().optional(),
});

type ManualUploadFormValues = z.infer<typeof manualUploadSchema>;

interface UploadResponse {
  drawingId: number;
  revisionId: number;
  pageCount: number;
  extractedText: {
    fullText: string;
    metadata: {
      sheetNumbers: string[];
      roomNames: string[];
      dimensions: string[];
    };
  };
  aiAnalysis?: {
    title?: string;
    titleBlock?: {
      discipline?: string;
      floor?: string;
      sheetNumber?: string;
      projectName?: string;
    };
    layers?: string[];
    elements?: Array<{
      type: string;
      description: string;
      quantity?: number;
    }>;
    dimensions?: Array<{
      value: string;
      unit?: string;
    }>;
    summary?: string;
  };
}

interface DrawingPage {
  id: number;
  pageNumber: number;
  imageUrl: string;
  extractedText: string | null;
  aiExtractedData: any;
}

export function IngestPlansModal() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState<Step>("selection");
  const [uploadMode, setUploadMode] = useState<'ai' | 'manual' | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState<DrawingFormData>({
    sheetNo: "",
    title: "",
    buildingId: 1,
    floorId: 1,
    disciplineId: 1,
  });
  const [hasConflict, setHasConflict] = useState(false);
  const [conflictResolution, setConflictResolution] = useState<"version" | "new">("version");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [drawingPages, setDrawingPages] = useState<DrawingPage[]>([]);
  const [createdDrawingId, setCreatedDrawingId] = useState<number | null>(null);

  // Manual upload form
  const manualForm = useForm<ManualUploadFormValues>({
    resolver: zodResolver(manualUploadSchema),
    defaultValues: {
      sheetNo: "",
      title: "",
      disciplineId: "",
      floorId: "",
      versionType: "new",
      parentDrawingId: "",
      revisionNotes: "",
    },
  });

  const watchedFile = manualForm.watch("file");
  const watchedVersionType = manualForm.watch("versionType");
  const watchedDisciplineId = manualForm.watch("disciplineId");

  // Fetch disciplines (public reference data - no auth required)
  const { data: disciplines = [], isLoading: isDisciplinesLoading, error: disciplinesError } = useQuery<Discipline[]>({
    queryKey: ["/api/disciplines"],
    queryFn: () => apiRequest("/api/disciplines"),
  });

  // Fetch floors (public reference data - no auth required)
  const { data: floors = [], isLoading: isFloorsLoading, error: floorsError } = useQuery<Floor[]>({
    queryKey: ["/api/floors"],
    queryFn: () => apiRequest("/api/floors"),
  });

  // Fetch drawings (for update mode) - with pagination
  const { data: drawingsData, isLoading: isDrawingsLoading } = useQuery<{
    drawings: DrawingWithDetails[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    queryKey: ["/api/drawings", 1, 100],
    queryFn: async () => {
      const res = await fetch(`/api/drawings?page=1&limit=100`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch drawings");
      return await res.json();
    },
    enabled: watchedVersionType === "update",
  });

  const existingDrawings = drawingsData?.drawings || [];

  // Filter drawings by discipline if selected
  const filteredDrawings = existingDrawings.filter(
    (drawing) => !watchedDisciplineId || drawing.disciplineId === watchedDisciplineId
  );

  // Create drawing mutation
  const createDrawingMutation = useMutation({
    mutationFn: async (data: DrawingFormData) => {
      return await apiRequest<{ id: number }>("/api/drawings", {
        method: "POST",
        body: data,
      });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في إنشاء المخطط",
        description: error.message || "حدث خطأ أثناء إنشاء المخطط",
        variant: "destructive",
      });
    },
  });

  // Upload file mutation
  const uploadFileMutation = useMutation({
    mutationFn: async ({ drawingId, file }: { drawingId: number; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch(`/api/drawings/${drawingId}/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Upload failed");
      }

      return await response.json() as UploadResponse;
    },
    onSuccess: async (data) => {
      setUploadResult(data);
      
      // Fetch all pages for this revision
      const pagesResponse = await fetch(`/api/revisions/${data.revisionId}/pages`, {
        credentials: "include",
      });
      
      if (pagesResponse.ok) {
        const pages = await pagesResponse.json();
        setDrawingPages(pages);
      }
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/drawings"] });
      
      setCurrentStep("success");
      
      toast({
        title: "تم الرفع بنجاح!",
        description: data.pageCount > 1 
          ? `تم معالجة ${data.pageCount} صفحات بنجاح`
          : "تم رفع المخطط بنجاح",
      });
    },
    onError: (error: any) => {
      setCurrentStep("review");
      toast({
        title: "خطأ في الرفع",
        description: error.message || "حدث خطأ أثناء رفع الملف",
        variant: "destructive",
      });
    },
  });

  // Manual upload mutation
  const manualUploadMutation = useMutation({
    mutationFn: async (values: ManualUploadFormValues) => {
      const formData = new FormData();
      formData.append("file", values.file);
      formData.append("sheetNo", values.sheetNo);
      formData.append("title", values.title);
      formData.append("disciplineId", values.disciplineId);
      if (values.floorId) formData.append("floorId", values.floorId);
      formData.append("versionType", values.versionType);
      if (values.parentDrawingId) formData.append("parentDrawingId", values.parentDrawingId);
      if (values.revisionNotes) formData.append("revisionNotes", values.revisionNotes);

      const response = await fetch("/api/drawings/upload-manual", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Upload failed");
      }

      return await response.json() as UploadResponse;
    },
    onSuccess: async (data) => {
      setUploadResult(data);
      
      // Fetch all pages for this revision if multi-page
      if (data.pageCount > 1) {
        const pagesResponse = await fetch(`/api/revisions/${data.revisionId}/pages`, {
          credentials: "include",
        });
        
        if (pagesResponse.ok) {
          const pages = await pagesResponse.json();
          setDrawingPages(pages);
        }
      }
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/drawings"] });
      
      setCurrentStep("success");
      
      toast({
        title: "تم الرفع بنجاح!",
        description: "تم رفع المخطط ومعالجته بنجاح",
      });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في الرفع",
        description: error.message || "حدث خطأ أثناء رفع الملف",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    
    // Auto-fill sheet number from filename if possible
    const filename = file.name.replace(/\.(pdf|png|jpg|jpeg)$/i, "");
    const sheetMatch = filename.match(/[A-Z]-\d{3}/);
    
    setFormData({
      ...formData,
      sheetNo: sheetMatch ? sheetMatch[0] : filename,
      title: filename,
    });
    
    setCurrentStep("review");
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleProcess = async () => {
    if (!selectedFile) {
      toast({
        title: "لا يوجد ملف",
        description: "يرجى اختيار ملف أولاً",
        variant: "destructive",
      });
      return;
    }

    if (!formData.sheetNo.trim()) {
      toast({
        title: "رمز المخطط مطلوب",
        description: "يرجى إدخال رمز المخطط",
        variant: "destructive",
      });
      return;
    }

    setCurrentStep("processing");

    try {
      let drawingId = createdDrawingId;
      
      // Step 1: Create drawing only if not already created
      if (!drawingId) {
        const drawing = await createDrawingMutation.mutateAsync(formData);
        drawingId = drawing.id;
        setCreatedDrawingId(drawingId);
      }
      
      // Step 2: Upload file
      await uploadFileMutation.mutateAsync({
        drawingId,
        file: selectedFile,
      });
    } catch (error) {
      console.error("Process error:", error);
    }
  };

  const handleSaveAndClose = () => {
    router.push("/plans");
  };

  const handleSaveAndAddMore = () => {
    setCurrentStep("selection");
    setUploadMode(null);
    setSelectedFile(null);
    setFormData({
      sheetNo: "",
      title: "",
      buildingId: 1,
      floorId: 1,
      disciplineId: 1,
    });
    setUploadResult(null);
    setDrawingPages([]);
    setHasConflict(false);
    setCreatedDrawingId(null);
  };

  const handleCancelAndClose = () => {
    router.push("/plans");
  };

  const handleReset = () => {
    setCurrentStep("selection");
    setUploadMode(null);
    setSelectedFile(null);
    setHasConflict(false);
    setCreatedDrawingId(null);
  };

  const handleViewDrawing = () => {
    if (uploadResult) {
      router.push(`/sheets/${uploadResult.drawingId}`);
    }
  };

  // Handle manual form file selection
  const handleManualFileSelect = (file: File) => {
    manualForm.setValue("file", file, { shouldValidate: true });
    
    // Auto-fill sheet number and title from filename
    const filename = file.name.replace(/\.pdf$/i, "");
    const sheetMatch = filename.match(/[A-Z]-\d{3}/);
    
    if (!manualForm.getValues("sheetNo")) {
      manualForm.setValue("sheetNo", sheetMatch ? sheetMatch[0] : filename);
    }
    if (!manualForm.getValues("title")) {
      manualForm.setValue("title", filename);
    }
  };

  // Handle manual form drag and drop
  const handleManualDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleManualDragLeave = () => {
    setIsDragging(false);
  };

  const handleManualDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") {
      handleManualFileSelect(file);
    } else if (file) {
      toast({
        title: "نوع ملف غير صحيح",
        description: "يرجى اختيار ملف PDF فقط",
        variant: "destructive",
      });
    }
  };

  // Handle manual form submission
  const handleManualFormSubmit = async (values: ManualUploadFormValues) => {
    setCurrentStep("processing");
    try {
      await manualUploadMutation.mutateAsync(values);
    } catch (error) {
      setCurrentStep("manual_form");
      console.error("Manual upload error:", error);
    }
  };

  const steps = [
    { id: "selection", label: "اختيار الطريقة", icon: FileSearch, active: currentStep === "selection" },
    { id: "upload", label: "رفع الملفات", icon: Upload, active: currentStep === "upload" || currentStep === "manual_form" },
    { id: "review", label: "المراجعة والتوصيل", icon: FileText, active: currentStep === "review" },
    { id: "processing", label: "المعالجة", icon: AlertCircle, active: currentStep === "processing" || currentStep === "success" },
  ];

  const isPending = createDrawingMutation.isPending || uploadFileMutation.isPending;

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl rounded-xl bg-card shadow-2xl flex flex-col border">
        {/* Header */}
        <div className="p-6 border-b">
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-modal-title">
            استيراد وإنشاء مخططات جديدة
          </h1>
          <p className="text-muted-foreground mt-1" data-testid="text-modal-description">
            اتبع الخطوات لرفع ومعالجة مخططات البناء الخاصة بك
          </p>
        </div>

        {/* Main Content */}
        <div className="flex flex-grow">
          {/* Stepper Sidebar */}
          <div className="w-1/4 p-6 border-l">
            <div className="space-y-6">
              {steps.map((step, index) => (
                <div key={step.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex items-center justify-center size-10 rounded-full transition-colors ${
                        step.active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                      data-testid={`step-indicator-${step.id}`}
                    >
                      <step.icon className="h-5 w-5" />
                    </div>
                    {index < steps.length - 1 && (
                      <div
                        className={`w-0.5 h-12 mt-2 ${
                          step.active ? "bg-primary" : "bg-muted"
                        }`}
                      />
                    )}
                  </div>
                  <div className="flex-1 pt-2">
                    <p
                      className={`text-base font-medium ${
                        step.active ? "text-primary" : "text-foreground"
                      }`}
                      data-testid={`text-step-${step.id}`}
                    >
                      {step.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Content Area */}
          <div className="w-3/4 p-6 space-y-6 border-l">
            {/* Step 0: Selection */}
            {currentStep === "selection" && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-foreground" data-testid="text-selection-title">
                    اختر طريقة رفع المخطط
                  </h2>
                  <p className="text-sm text-muted-foreground mt-2">
                    اختر الطريقة المناسبة لحالة المخططات لديك
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                  {/* AI-Assisted Upload Option */}
                  <div
                    className="group relative rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/10 to-accent/5 p-6 cursor-pointer hover-elevate active-elevate-2 transition-all"
                    onClick={() => {
                      setUploadMode('ai');
                      setCurrentStep('upload');
                    }}
                    data-testid="card-ai-upload"
                  >
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="p-4 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground">
                        <Bot className="h-10 w-10" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold text-foreground">
                          رفع بمساعدة الذكاء الاصطناعي
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          مثالي للمخططات الجديدة - يستخرج المعلومات تلقائياً من المخطط
                        </p>
                      </div>
                      <Button 
                        className="w-full mt-4"
                        data-testid="button-select-ai"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadMode('ai');
                          setCurrentStep('upload');
                        }}
                      >
                        اختيار هذه الطريقة
                      </Button>
                    </div>
                  </div>

                  {/* Manual Upload Option */}
                  <div
                    className="group relative rounded-xl border-2 border-border bg-gradient-to-br from-secondary/10 to-muted/5 p-6 cursor-pointer hover-elevate active-elevate-2 transition-all"
                    onClick={() => {
                      setUploadMode('manual');
                      setCurrentStep('manual_form');
                    }}
                    data-testid="card-manual-upload"
                  >
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="p-4 rounded-full bg-gradient-to-br from-secondary to-muted text-secondary-foreground">
                        <Upload className="h-10 w-10" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold text-foreground">
                          رفع يدوي
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          للمخططات الممسوحة أو منخفضة الجودة - إدخال المعلومات يدوياً
                        </p>
                      </div>
                      <Button 
                        variant="secondary"
                        className="w-full mt-4"
                        data-testid="button-select-manual"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadMode('manual');
                          setCurrentStep('manual_form');
                        }}
                      >
                        اختيار هذه الطريقة
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Upload (AI Mode) */}
            {currentStep === "upload" && (
              <div className="space-y-4">
                <div
                  className={`flex flex-col items-center gap-6 rounded-lg border-2 border-dashed px-6 py-12 transition-colors ${
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  data-testid="dropzone-upload"
                >
                  <div className="flex flex-col items-center gap-3 text-center">
                    <Upload className="h-12 w-12 text-primary" />
                    <div>
                      <p className="text-lg font-bold text-foreground" data-testid="text-dropzone-title">
                        اسحب وأفلت الملفات هنا
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        الصيغ المدعومة: PDF, JPG, PNG
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = ".pdf,.jpg,.jpeg,.png";
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) handleFileSelect(file);
                      };
                      input.click();
                    }}
                    data-testid="button-browse-files"
                  >
                    تصفح الملفات
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Review & Map */}
            {currentStep === "review" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-foreground" data-testid="text-review-title">
                    مراجعة وتوصيل بيانات المخطط
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    يرجى مراجعة البيانات والتأكيد
                  </p>
                </div>

                {/* File Preview */}
                <div className="p-4 rounded-lg border bg-card space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-24 h-24 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                      <FileText className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <div className="flex-grow space-y-3">
                      <div className="flex justify-between items-center">
                        <p className="font-semibold text-foreground" data-testid="text-filename">
                          {selectedFile?.name}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleReset}
                          data-testid="button-remove-file"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Form Fields */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="plan-code">
                            رمز المخطط <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="plan-code"
                            value={formData.sheetNo}
                            onChange={(e) =>
                              setFormData({ ...formData, sheetNo: e.target.value })
                            }
                            data-testid="input-plan-code"
                          />
                        </div>
                        <div>
                          <Label htmlFor="plan-title">عنوان المخطط</Label>
                          <Input
                            id="plan-title"
                            value={formData.title}
                            onChange={(e) =>
                              setFormData({ ...formData, title: e.target.value })
                            }
                            data-testid="input-plan-title"
                          />
                        </div>
                        <div>
                          <Label htmlFor="building">
                            المبنى <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={formData.buildingId.toString()}
                            onValueChange={(value) =>
                              setFormData({ ...formData, buildingId: parseInt(value) })
                            }
                          >
                            <SelectTrigger id="building" data-testid="select-building">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">البرج الرئيسي</SelectItem>
                              <SelectItem value="2">المبنى الملحق</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="floor">
                            الطابق <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={formData.floorId.toString()}
                            onValueChange={(value) =>
                              setFormData({ ...formData, floorId: parseInt(value) })
                            }
                          >
                            <SelectTrigger id="floor" data-testid="select-floor">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">الطابق الأرضي</SelectItem>
                              <SelectItem value="2">المستوى 1</SelectItem>
                              <SelectItem value="3">المستوى 2</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="discipline">
                            التخصص <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={formData.disciplineId.toString()}
                            onValueChange={(value) =>
                              setFormData({ ...formData, disciplineId: parseInt(value) })
                            }
                          >
                            <SelectTrigger id="discipline" data-testid="select-discipline">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">معماري</SelectItem>
                              <SelectItem value="2">إنشائي</SelectItem>
                              <SelectItem value="3">كهروميكانيك</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Conflict Resolution */}
                  {hasConflict && (
                    <div className="flex items-start gap-4 bg-warning/10 p-4 rounded-lg border border-warning/20">
                      <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                      <div className="flex-grow space-y-3">
                        <p className="font-semibold text-warning-foreground">
                          يوجد مخطط بهذا الرمز مسبقاً
                        </p>
                        <p className="text-sm text-warning-foreground/80">
                          كيف تريد المتابعة؟
                        </p>
                        <RadioGroup
                          value={conflictResolution}
                          onValueChange={(value) =>
                            setConflictResolution(value as "version" | "new")
                          }
                          className="space-y-2"
                        >
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <RadioGroupItem
                              value="version"
                              id="new-version"
                              data-testid="radio-new-version"
                            />
                            <Label htmlFor="new-version" className="cursor-pointer">
                              إنشاء نسخة جديدة من المخطط الموجود
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <RadioGroupItem
                              value="new"
                              id="new-plan"
                              data-testid="radio-new-plan"
                            />
                            <Label htmlFor="new-plan" className="cursor-pointer">
                              إنشاء مخطط جديد منفصل (يتطلب تغيير الرمز)
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Processing */}
            {currentStep === "processing" && (
              <div className="p-8 rounded-lg border border-dashed bg-muted/30 flex flex-col items-center justify-center text-center space-y-4 min-h-[300px]">
                <div className="relative">
                  <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
                <div className="space-y-2">
                  <p className="text-foreground font-medium" data-testid="text-processing">
                    جاري معالجة الملفات...
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedFile?.name.toLowerCase().endsWith('.pdf') 
                      ? "جاري استخراج الصفحات وتحليل المحتوى..."
                      : "جاري رفع الملف وتحليله..."}
                  </p>
                </div>
                <Progress value={66} className="w-full max-w-xs" />
              </div>
            )}

            {/* Manual Upload Form */}
            {currentStep === "manual_form" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-foreground" data-testid="text-manual-form-title">
                    رفع يدوي - إدخال البيانات
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    أدخل معلومات المخطط يدوياً
                  </p>
                </div>

                {/* Loading state - show while disciplines/floors are loading */}
                {(isDisciplinesLoading || isFloorsLoading) && (
                  <div className="p-4 rounded-lg border border-primary/20 bg-primary/10">
                    <p className="text-sm text-primary">
                      جاري تحميل البيانات...
                    </p>
                  </div>
                )}

                {/* Error state - if disciplines or floors failed to load */}
                {(disciplinesError || floorsError) && (
                  <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/10">
                    <p className="text-sm text-destructive">
                      حدث خطأ في تحميل البيانات المطلوبة. يرجى إعادة المحاولة.
                    </p>
                  </div>
                )}

                <Form {...manualForm}>
                  <form onSubmit={manualForm.handleSubmit(handleManualFormSubmit)} className="space-y-6">
                    {/* 1. File Upload Section */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-foreground">رفع الملف</h3>
                      
                      {!watchedFile ? (
                        <div
                          className={`flex flex-col items-center gap-4 rounded-lg border-2 border-dashed px-6 py-8 transition-colors cursor-pointer ${
                            isDragging
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                          onDragOver={handleManualDragOver}
                          onDragLeave={handleManualDragLeave}
                          onDrop={handleManualDrop}
                          onClick={() => {
                            const input = document.createElement("input");
                            input.type = "file";
                            input.accept = ".pdf";
                            input.onchange = (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                              if (file) handleManualFileSelect(file);
                            };
                            input.click();
                          }}
                          data-testid="dropzone-manual-upload"
                        >
                          <Upload className="h-10 w-10 text-primary" />
                          <div className="text-center">
                            <p className="font-medium text-foreground">
                              اسحب وأفلت ملف PDF هنا أو انقر للاختيار
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                              PDF فقط
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-lg border bg-card flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                              <FileText className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground text-sm" data-testid="text-selected-filename">
                                {watchedFile.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {(watchedFile.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => manualForm.setValue("file", undefined as any)}
                            data-testid="button-remove-manual-file"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      {manualForm.formState.errors.file && (
                        <p className="text-sm text-destructive">
                          {manualForm.formState.errors.file.message}
                        </p>
                      )}
                    </div>

                    {/* 2. Basic Information */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-foreground">معلومات أساسية</h3>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={manualForm.control}
                          name="sheetNo"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                رقم اللوحة <span className="text-destructive">*</span>
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="مثال: A-101"
                                  data-testid="input-manual-sheet-no"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={manualForm.control}
                          name="title"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                اسم المخطط <span className="text-destructive">*</span>
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="مثال: Ground Floor Plan"
                                  data-testid="input-manual-title"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={manualForm.control}
                          name="disciplineId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                التخصص <span className="text-destructive">*</span>
                              </FormLabel>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                                disabled={isDisciplinesLoading}
                              >
                                <FormControl>
                                  <SelectTrigger data-testid="select-manual-discipline">
                                    <SelectValue placeholder="اختر التخصص" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {disciplines.map((discipline) => (
                                    <SelectItem
                                      key={discipline.id}
                                      value={discipline.id}
                                    >
                                      {discipline.name}
                                    </SelectItem>
                                  ))}
                                  {disciplines.length === 0 && !isDisciplinesLoading && (
                                    <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                                      لا توجد تخصصات متاحة
                                    </div>
                                  )}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={manualForm.control}
                          name="floorId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>الطابق (اختياري)</FormLabel>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                                disabled={isFloorsLoading}
                              >
                                <FormControl>
                                  <SelectTrigger data-testid="select-manual-floor">
                                    <SelectValue placeholder="اختر الطابق" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {floors.map((floor) => (
                                    <SelectItem key={floor.id} value={floor.id}>
                                      {floor.name}
                                    </SelectItem>
                                  ))}
                                  {floors.length === 0 && !isFloorsLoading && (
                                    <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                                      لا توجد طوابق متاحة
                                    </div>
                                  )}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* 3. Version Type */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-foreground">نوع الرفع</h3>
                      
                      <FormField
                        control={manualForm.control}
                        name="versionType"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <RadioGroup
                                value={field.value}
                                onValueChange={field.onChange}
                                className="space-y-3"
                              >
                                <div className="flex items-center space-x-2 space-x-reverse">
                                  <RadioGroupItem
                                    value="new"
                                    id="version-new"
                                    data-testid="radio-version-new"
                                  />
                                  <Label htmlFor="version-new" className="cursor-pointer font-normal">
                                    مخطط جديد
                                  </Label>
                                </div>
                                <div className="flex items-center space-x-2 space-x-reverse">
                                  <RadioGroupItem
                                    value="update"
                                    id="version-update"
                                    data-testid="radio-version-update"
                                  />
                                  <Label htmlFor="version-update" className="cursor-pointer font-normal">
                                    تحديث لمخطط موجود
                                  </Label>
                                </div>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* 4. Conditional: Parent Drawing Selection */}
                    {watchedVersionType === "update" && (
                      <div className="space-y-3 p-4 rounded-lg bg-muted/30 border">
                        <FormField
                          control={manualForm.control}
                          name="parentDrawingId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                اختر المخطط للتحديث <span className="text-destructive">*</span>
                              </FormLabel>
                              <Select
                                value={field.value}
                                onValueChange={field.onChange}
                                disabled={isDrawingsLoading}
                              >
                                <FormControl>
                                  <SelectTrigger data-testid="select-parent-drawing">
                                    <SelectValue placeholder="اختر المخطط" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {filteredDrawings.length === 0 ? (
                                    <div className="p-2 text-sm text-muted-foreground text-center">
                                      {watchedDisciplineId
                                        ? "لا توجد مخططات في هذا التخصص"
                                        : "لا توجد مخططات متاحة"}
                                    </div>
                                  ) : (
                                    filteredDrawings.map((drawing) => (
                                      <SelectItem
                                        key={drawing.id}
                                        value={drawing.id}
                                      >
                                        {drawing.sheetNo} - {drawing.title}
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    {/* 5. Revision Notes */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-foreground">ملاحظات الإصدار (اختياري)</h3>
                      
                      <FormField
                        control={manualForm.control}
                        name="revisionNotes"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder="اذكر التغييرات أو التحديثات في هذا الإصدار، مثلاً: تصحيح الأبعاد، تحديث توزيع الغرف"
                                rows={3}
                                data-testid="textarea-revision-notes"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Form Actions */}
                    <div className="flex gap-3 pt-4 border-t">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setCurrentStep("selection");
                          manualForm.reset();
                        }}
                        disabled={manualUploadMutation.isPending}
                        data-testid="button-cancel-manual"
                      >
                        إلغاء
                      </Button>
                      <Button
                        type="submit"
                        disabled={!manualForm.formState.isValid || !watchedFile || manualUploadMutation.isPending}
                        className="flex-1"
                        data-testid="button-submit-manual"
                      >
                        {manualUploadMutation.isPending ? "جاري الرفع..." : "رفع المخطط"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            )}

            {/* Step 4: Success */}
            {currentStep === "success" && uploadResult && (
              <div className="space-y-6">
                {/* Hero Section */}
                <div className="p-8 rounded-lg bg-gradient-to-br from-success/10 to-success/5 border border-success/20 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-success/20 rounded-full blur-2xl"></div>
                    <CheckCircle2 className="relative h-20 w-20 text-success" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-foreground" data-testid="text-success-title">
                      تم استخراج المعلومات بنجاح!
                    </h2>
                    <p className="text-foreground/70 text-base">
                      {uploadResult.pageCount > 1
                        ? `تمت معالجة ${uploadResult.pageCount} صفحات وتحليلها بالذكاء الاصطناعي`
                        : "تم تحليل المخطط واستخراج المعلومات الرئيسية"}
                    </p>
                  </div>
                </div>

                {/* Multi-page Results */}
                {drawingPages.length > 1 && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-foreground">
                      الصفحات المعالجة ({drawingPages.length})
                    </h3>
                    <div className="grid grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
                      {drawingPages.map((page) => (
                        <div
                          key={page.id}
                          className="group relative rounded-lg border bg-card overflow-hidden hover-elevate active-elevate-2 cursor-pointer"
                          onClick={() => router.push(`/sheets/${uploadResult.drawingId}?page=${page.pageNumber}`)}
                          data-testid={`page-thumbnail-${page.pageNumber}`}
                        >
                          <div className="aspect-[8.5/11] bg-muted flex items-center justify-center relative">
                            {page.imageUrl ? (
                              <img
                                src={page.imageUrl}
                                alt={`Page ${page.pageNumber}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <ImageIcon className="h-12 w-12 text-muted-foreground" />
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                          </div>
                          <div className="p-2 border-t">
                            <p className="text-xs font-medium text-center text-foreground">
                              صفحة {page.pageNumber}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Analysis Results - Always visible */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent flex-1"></div>
                    <div className="flex items-center gap-2 px-3">
                      <Bot className="h-4 w-4 text-primary" />
                      <h3 className="text-base font-semibold text-foreground">
                        تحليل الذكاء الاصطناعي
                      </h3>
                    </div>
                    <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent flex-1"></div>
                  </div>
                  
                  {/* AI Summary with Icon - Always visible */}
                  <div className="p-5 rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-foreground mb-2 text-sm">ملخص المخطط</p>
                        {uploadResult.aiAnalysis?.summary ? (
                          <p className="text-sm text-foreground/80 leading-relaxed">{uploadResult.aiAnalysis.summary}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">لم يتم الكشف عن ملخص</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Title Block Information Grid - Always visible */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Sheet Number */}
                    <div className="p-4 rounded-lg border-2 border-border bg-card hover-elevate">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">رقم اللوحة</p>
                      </div>
                      {uploadResult.aiAnalysis?.titleBlock?.sheetNumber ? (
                        <p className="text-lg font-bold text-foreground">{uploadResult.aiAnalysis.titleBlock.sheetNumber}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">لم يتم الكشف</p>
                      )}
                    </div>

                    {/* Discipline */}
                    <div className="p-4 rounded-lg border-2 border-border bg-card hover-elevate">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                        <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">التخصص</p>
                      </div>
                      {uploadResult.aiAnalysis?.titleBlock?.discipline ? (
                        <p className="text-lg font-bold text-foreground">{uploadResult.aiAnalysis.titleBlock.discipline}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">لم يتم الكشف</p>
                      )}
                    </div>

                    {/* Floor */}
                    <div className="p-4 rounded-lg border-2 border-border bg-card hover-elevate">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">الطابق</p>
                      </div>
                      {uploadResult.aiAnalysis?.titleBlock?.floor ? (
                        <p className="text-lg font-bold text-foreground">{uploadResult.aiAnalysis.titleBlock.floor}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">لم يتم الكشف</p>
                      )}
                    </div>

                    {/* Project Name */}
                    <div className="p-4 rounded-lg border-2 border-border bg-card hover-elevate">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                        <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">اسم المشروع</p>
                      </div>
                      {uploadResult.aiAnalysis?.titleBlock?.projectName ? (
                        <p className="text-lg font-bold text-foreground">{uploadResult.aiAnalysis.titleBlock.projectName}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">لم يتم الكشف</p>
                      )}
                    </div>

                    {/* Title */}
                    <div className="p-4 rounded-lg border-2 border-border bg-card hover-elevate col-span-2">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
                        <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">عنوان المخطط</p>
                      </div>
                      {uploadResult.aiAnalysis?.title ? (
                        <p className="text-lg font-bold text-foreground">{uploadResult.aiAnalysis.title}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">لم يتم الكشف</p>
                      )}
                    </div>
                  </div>

                  {/* Detected Building Elements - Always visible */}
                  <div className="p-5 rounded-xl border bg-card">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-1.5 rounded-md bg-accent/20 text-accent">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                      <p className="font-semibold text-foreground">العناصر الإنشائية المكتشفة</p>
                      {uploadResult.aiAnalysis?.elements && uploadResult.aiAnalysis.elements.length > 0 && (
                        <span className="text-xs text-muted-foreground">({uploadResult.aiAnalysis.elements.length})</span>
                      )}
                    </div>
                    {uploadResult.aiAnalysis?.elements && uploadResult.aiAnalysis.elements.length > 0 ? (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          {uploadResult.aiAnalysis.elements.slice(0, 10).map((element, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover-elevate">
                              <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-accent"></div>
                                <span className="text-sm font-medium text-foreground">{element.type}</span>
                              </div>
                              {element.quantity && (
                                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-accent/20 text-accent">
                                  {element.quantity}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                        {uploadResult.aiAnalysis.elements.length > 10 && (
                          <p className="text-xs text-muted-foreground text-center mt-3">
                            + {uploadResult.aiAnalysis.elements.length - 10} عنصر إضافي
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground italic text-center py-4">لم يتم الكشف عن عناصر إنشائية</p>
                    )}
                  </div>

                  {/* Dimensions - Always visible */}
                  <div className="p-4 rounded-lg border bg-card">
                    <p className="font-semibold text-foreground mb-3 flex items-center gap-2">
                      <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      الأبعاد المكتشفة
                    </p>
                    {uploadResult.aiAnalysis?.dimensions && uploadResult.aiAnalysis.dimensions.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {uploadResult.aiAnalysis.dimensions.slice(0, 6).map((dim, idx) => (
                          <span key={idx} className="px-3 py-1.5 text-sm font-mono rounded-md bg-muted text-foreground border">
                            {dim.value} {dim.unit || ''}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic text-center py-2">لم يتم الكشف عن أبعاد</p>
                    )}
                  </div>
                </div>

                {/* Extracted Text Preview - Always visible */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent flex-1"></div>
                    <div className="flex items-center gap-2 px-3">
                      <FileSearch className="h-4 w-4 text-accent" />
                      <h3 className="text-base font-semibold text-foreground">
                        استخراج النصوص من PDF
                      </h3>
                    </div>
                    <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent flex-1"></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Sheet Numbers */}
                    <div className="p-4 rounded-lg border bg-gradient-to-br from-card to-muted/20">
                      <p className="font-semibold text-xs text-muted-foreground mb-2 uppercase tracking-wide">أرقام اللوحات</p>
                      {uploadResult.extractedText?.metadata?.sheetNumbers && uploadResult.extractedText.metadata.sheetNumbers.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {uploadResult.extractedText.metadata.sheetNumbers.slice(0, 5).map((num, idx) => (
                            <span key={idx} className="px-2 py-1 text-xs font-mono rounded bg-primary/10 text-primary border border-primary/20">
                              {num}
                            </span>
                          ))}
                          {uploadResult.extractedText.metadata.sheetNumbers.length > 5 && (
                            <span className="px-2 py-1 text-xs rounded bg-muted text-muted-foreground">
                              +{uploadResult.extractedText.metadata.sheetNumbers.length - 5}
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">لم يتم الكشف</p>
                      )}
                    </div>

                    {/* Room Names */}
                    <div className="p-4 rounded-lg border bg-gradient-to-br from-card to-muted/20">
                      <p className="font-semibold text-xs text-muted-foreground mb-2 uppercase tracking-wide">الغرف والمساحات</p>
                      {uploadResult.extractedText?.metadata?.roomNames && uploadResult.extractedText.metadata.roomNames.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {uploadResult.extractedText.metadata.roomNames.slice(0, 5).map((room, idx) => (
                            <span key={idx} className="px-2 py-1 text-xs rounded bg-accent/10 text-accent border border-accent/20">
                              {room}
                            </span>
                          ))}
                          {uploadResult.extractedText.metadata.roomNames.length > 5 && (
                            <span className="px-2 py-1 text-xs rounded bg-muted text-muted-foreground">
                              +{uploadResult.extractedText.metadata.roomNames.length - 5}
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">لم يتم الكشف</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-4 p-6 border-t">
          {/* Cancel button always visible */}
          {currentStep !== "success" && (
            <Button
              variant="outline"
              onClick={handleCancelAndClose}
              disabled={isPending}
              data-testid="button-cancel"
            >
              إلغاء
            </Button>
          )}
          
          {/* Review step buttons */}
          {currentStep === "review" && (
            <Button
              onClick={handleProcess}
              disabled={isPending}
              data-testid="button-confirm-process"
            >
              {isPending ? "جاري المعالجة..." : "تأكيد ومعالجة"}
            </Button>
          )}
          
          {/* Success step buttons */}
          {currentStep === "success" && (
            <>
              <Button
                variant="outline"
                onClick={handleSaveAndAddMore}
                data-testid="button-save-add-more"
              >
                إضافة مخطط جديد
              </Button>
              <Button
                variant="outline"
                onClick={handleSaveAndClose}
                data-testid="button-back-to-plans"
              >
                العودة للمخططات
              </Button>
              <Button
                onClick={handleViewDrawing}
                data-testid="button-view-drawing"
              >
                عرض المخطط
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
