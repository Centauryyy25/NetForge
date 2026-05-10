"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { z } from "zod/v4";
import { REQUEST_TYPE_LABELS } from "@/lib/constants";
import { createServiceRequestSchema } from "@/validators/service-request";

const formSchema = createServiceRequestSchema.omit({ customerId: true });
type FormValues = z.infer<typeof formSchema>;

export async function submitServiceRequest(
  data: FormValues,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const res = await fetchImpl("/api/service-requests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      json?.error ?? `Gagal mengirim ajuan (HTTP ${res.status})`
    );
  }
}

export function ServiceRequestForm() {
  const router = useRouter();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: undefined,
      name: "",
      phone: "",
      description: "",
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = form;

  const onSubmit = handleSubmit(async (data) => {
    try {
      await submitServiceRequest(data);
      toast.success("Ajuan berhasil dibuat");
      router.push("/service-requests");
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Terjadi kesalahan jaringan"
      );
    }
  });

  const typeValue = watch("type");

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="type">Jenis Ajuan *</Label>
            <Select
              value={typeValue ?? ""}
              onValueChange={(v) =>
                setValue("type", v as FormValues["type"], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger id="type" aria-invalid={!!errors.type}>
                <SelectValue placeholder="Pilih jenis" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(REQUEST_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.type && (
              <p className="text-sm text-destructive">{errors.type.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nama *</Label>
              <Input
                id="name"
                placeholder="Nama lengkap"
                aria-invalid={!!errors.name}
                {...register("name")}
              />
              {errors.name && (
                <p className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">No. Telepon *</Label>
              <Input
                id="phone"
                placeholder="08xxxxxxxxxx"
                aria-invalid={!!errors.phone}
                {...register("phone")}
              />
              {errors.phone && (
                <p className="text-sm text-destructive">
                  {errors.phone.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Deskripsi *</Label>
            <Textarea
              id="description"
              rows={4}
              placeholder="Jelaskan detail ajuan atau keluhan..."
              aria-invalid={!!errors.description}
              {...register("description")}
            />
            {errors.description && (
              <p className="text-sm text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Kirim Ajuan
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              Batal
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
