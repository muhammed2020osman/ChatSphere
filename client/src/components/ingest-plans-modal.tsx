import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, AlertCircle, CheckCircle2, FileText, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type Step = "upload" | "review" | "processing" | "success";

interface DrawingFormData {
  sheetNo: string;
  title: string;
  buildingId: number;
  floorId: number;
  disciplineId: number;
}

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
}

interface DrawingPage {
  id: number;
  pageNumber: number;
  imageUrl: string;
  extractedText: string | null;
  aiExtractedData: any;
}

export function IngestPlansModal() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState<Step>("upload");
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
      // Step 1: Create drawing
      const drawing = await createDrawingMutation.mutateAsync(formData);
      
      // Step 2: Upload file
      await uploadFileMutation.mutateAsync({
        drawingId: drawing.id,
        file: selectedFile,
      });
    } catch (error) {
      console.error("Process error:", error);
    }
  };

  const handleSaveAndClose = () => {
    setLocation("/plans");
  };

  const handleSaveAndAddMore = () => {
    setCurrentStep("upload");
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
  };

  const handleCancelAndClose = () => {
    setLocation("/plans");
  };

  const handleReset = () => {
    setCurrentStep("upload");
    setSelectedFile(null);
    setHasConflict(false);
  };

  const handleViewDrawing = () => {
    if (uploadResult) {
      setLocation(`/sheet-viewer/${uploadResult.drawingId}`);
    }
  };

  const steps = [
    { id: "upload", label: "رفع الملفات", icon: Upload, active: currentStep === "upload" },
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
            {/* Step 1: Upload */}
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

            {/* Step 4: Success */}
            {currentStep === "success" && uploadResult && (
              <div className="space-y-6">
                <div className="p-8 rounded-lg bg-success/10 border border-success/20 flex flex-col items-center justify-center text-center space-y-4">
                  <CheckCircle2 className="h-16 w-16 text-success" />
                  <div className="space-y-2">
                    <h2 className="text-xl font-bold text-foreground" data-testid="text-success-title">
                      المخطط جاهز!
                    </h2>
                    <p className="text-foreground/80">
                      {uploadResult.pageCount > 1
                        ? `تم معالجة ${uploadResult.pageCount} صفحات بنجاح`
                        : "تم رفع المخطط بنجاح"}
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
                          onClick={() => setLocation(`/sheet-viewer/${uploadResult.drawingId}?page=${page.pageNumber}`)}
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

                {/* Extracted Text Preview */}
                {uploadResult.extractedText && uploadResult.extractedText.metadata && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-foreground">
                      البيانات المستخرجة
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {uploadResult.extractedText.metadata.sheetNumbers.length > 0 && (
                        <div className="p-3 rounded-lg border bg-card">
                          <p className="font-medium text-muted-foreground mb-1">أرقام اللوحات</p>
                          <p className="text-foreground">
                            {uploadResult.extractedText.metadata.sheetNumbers.slice(0, 3).join(", ")}
                            {uploadResult.extractedText.metadata.sheetNumbers.length > 3 && "..."}
                          </p>
                        </div>
                      )}
                      {uploadResult.extractedText.metadata.roomNames.length > 0 && (
                        <div className="p-3 rounded-lg border bg-card">
                          <p className="font-medium text-muted-foreground mb-1">الغرف</p>
                          <p className="text-foreground">
                            {uploadResult.extractedText.metadata.roomNames.slice(0, 3).join(", ")}
                            {uploadResult.extractedText.metadata.roomNames.length > 3 && "..."}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
