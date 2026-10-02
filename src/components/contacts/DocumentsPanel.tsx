"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  ExternalLink,
  FileImage,
  FileText,
  Loader2,
  Paperclip,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface DocItem {
  id: string;
  name: string;
  mime: string;
  size: number;
  dealTitle: string | null;
  stageName: string | null;
  uploadedBy: string | null;
  createdAt: string;
}

interface Upload {
  key: string;
  name: string;
  progress: number; // 0-100
  error?: string;
}

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";
const MAX_MB = 20;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** PUT directo al bucket con progreso (fetch no reporta progreso de subida; XHR si). */
function putWithProgress(url: string, file: File, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`El bucket respondio ${xhr.status}`));
    xhr.onerror = () => reject(new Error("No se pudo conectar con el almacenamiento (CORS o red)"));
    xhr.send(file);
  });
}

/**
 * Documentos de la ficha: lista + subida por boton o arrastrando. El archivo va del
 * navegador al bucket; el servidor solo firma y confirma.
 */
export function DocumentsPanel({ contactId }: { contactId: string }) {
  const [items, setItems] = useState<DocItem[]>([]);
  const [storageReady, setStorageReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    () =>
      fetch(`/api/documents?contactId=${contactId}`).then((r) =>
        r.ok ? (r.json() as Promise<{ items: DocItem[]; storage: boolean }>) : { items: [], storage: true }
      ),
    [contactId]
  );

  useEffect(() => {
    let alive = true;
    load().then((data) => {
      if (!alive) return;
      setItems(data.items);
      setStorageReady(data.storage);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [load]);

  const setUpload = (key: string, patch: Partial<Upload>) =>
    setUploads((list) => list.map((u) => (u.key === key ? { ...u, ...patch } : u)));

  const uploadOne = async (file: File) => {
    const key = `${file.name}-${Date.now()}-${Math.random()}`;
    setUploads((list) => [...list, { key, name: file.name, progress: 0 }]);
    try {
      if (file.size > MAX_MB * 1024 * 1024) throw new Error(`Supera los ${MAX_MB} MB`);
      const begin = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, name: file.name, mime: file.type, size: file.size }),
      });
      const started = await begin.json().catch(() => ({}));
      if (!begin.ok) throw new Error(started.error ?? "No se pudo iniciar la subida");

      await putWithProgress(started.uploadUrl, file, (pct) => setUpload(key, { progress: pct }));

      const confirm = await fetch(`/api/documents/${started.id}/confirm`, { method: "POST" });
      const confirmed = await confirm.json().catch(() => ({}));
      if (!confirm.ok) throw new Error(confirmed.error ?? "No se pudo confirmar la subida");

      setUploads((list) => list.filter((u) => u.key !== key));
      const data = await load();
      setItems(data.items);
    } catch (err) {
      setUpload(key, { error: (err as Error).message });
      toast.error(`${file.name}: ${(err as Error).message}`);
    }
  };

  const handleFiles = (files: FileList | File[]) => {
    for (const f of Array.from(files)) void uploadOne(f);
  };

  const remove = async (doc: DocItem) => {
    if (!confirm(`Eliminar "${doc.name}"?`)) return;
    const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "No se pudo eliminar");
      return;
    }
    setItems((list) => list.filter((d) => d.id !== doc.id));
    toast.success("Documento eliminado");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          Documentos {!loading && `(${items.length})`}
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="cursor-pointer"
          disabled={!storageReady}
          onClick={() => inputRef.current?.click()}
        >
          <UploadCloud className="h-4 w-4 mr-1" />
          Subir
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </CardHeader>
      <CardContent
        onDragOver={(e) => {
          e.preventDefault();
          if (storageReady) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (storageReady) handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "space-y-2 rounded-b-xl transition-colors",
          dragging && "bg-primary/5 ring-2 ring-inset ring-primary/40"
        )}
      >
        {!storageReady && (
          <p className="text-sm text-amber-700 bg-amber-500/10 rounded-lg px-3 py-2">
            El almacenamiento de archivos no esta configurado (variables <code>S3_*</code>).
          </p>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : items.length === 0 && uploads.length === 0 ? (
          <button
            type="button"
            disabled={!storageReady}
            onClick={() => inputRef.current?.click()}
            className="w-full rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground cursor-pointer transition-colors disabled:cursor-not-allowed"
          >
            <UploadCloud className="h-5 w-5 mx-auto mb-2" />
            Arrastra un PDF o una imagen, o toca para elegir.
            <span className="block text-xs mt-1 text-muted-foreground/80">
              PDF, JPG, PNG o WebP · hasta {MAX_MB} MB
            </span>
          </button>
        ) : (
          <ul className="divide-y divide-border/60">
            {uploads.map((u) => (
              <li key={u.key} className="flex items-center gap-3 py-2.5 text-sm">
                {u.error ? (
                  <FileText className="h-4 w-4 text-destructive shrink-0" />
                ) : (
                  <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate">{u.name}</p>
                  {u.error ? (
                    <p className="text-xs text-destructive">{u.error}</p>
                  ) : (
                    <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary transition-all" style={{ width: `${u.progress}%` }} />
                    </div>
                  )}
                </div>
                {u.error && (
                  <button
                    type="button"
                    onClick={() => setUploads((l) => l.filter((x) => x.key !== u.key))}
                    className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Quitar
                  </button>
                )}
              </li>
            ))}
            {items.map((doc) => {
              const Icon = doc.mime.startsWith("image/") ? FileImage : FileText;
              return (
                <li key={doc.id} className="flex items-center gap-3 py-2.5 text-sm group">
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <a
                      href={`/api/documents/${doc.id}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium truncate block hover:underline"
                    >
                      {doc.name}
                    </a>
                    <p className="text-xs text-muted-foreground truncate">
                      {formatSize(doc.size)}
                      {doc.uploadedBy && ` · ${doc.uploadedBy}`}
                      {" · "}
                      {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true, locale: es })}
                      {doc.stageName && (
                        <span className="ml-1.5 inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10.5px] font-medium text-foreground/70">
                          {doc.stageName}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <a
                      href={`/api/documents/${doc.id}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Abrir"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <a
                      href={`/api/documents/${doc.id}/download?dl=1`}
                      className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Descargar"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => remove(doc)}
                      className="p-1.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
