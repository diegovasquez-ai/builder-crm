import { cn } from "@/lib/utils";
import type { Channel } from "@/lib/channels/types";

/**
 * Iconos de canal como SVG inline.
 *
 * `lucide-react` dejo de publicar iconos de marca (Instagram y Facebook ya no existen
 * en el paquete), y traer una libreria entera de iconos por tres glifos no se justifica.
 * Los emojis quedan descartados por convencion del proyecto.
 */

interface IconProps {
  className?: string;
}

export function WhatsappIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn("h-3.5 w-3.5", className)}
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347Zm-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884Z" />
    </svg>
  );
}

export function InstagramIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("h-3.5 w-3.5", className)}
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function MessengerIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn("h-3.5 w-3.5", className)}
    >
      <path d="M12 2C6.5 2 2 6.14 2 11.25c0 2.88 1.43 5.45 3.67 7.13V22l3.36-1.84c.9.25 1.86.38 2.97.38 5.5 0 10-4.14 10-9.29S17.5 2 12 2Zm1.02 12.44-2.5-2.67-4.88 2.67 5.37-5.7 2.56 2.67 4.82-2.67-5.37 5.7Z" />
    </svg>
  );
}

const ICONS: Record<Channel, (props: IconProps) => React.ReactElement> = {
  whatsapp: WhatsappIcon,
  instagram: InstagramIcon,
  facebook: MessengerIcon,
};

export function ChannelIcon({
  channel,
  className,
}: {
  channel: Channel;
  className?: string;
}) {
  const Icon = ICONS[channel] ?? WhatsappIcon;
  return <Icon className={className} />;
}

/** Colores por canal. Tokens propios para que funcionen igual en light y dark. */
export const CHANNEL_COLORS: Record<Channel, string> = {
  whatsapp: "text-emerald-600 dark:text-emerald-400",
  instagram: "text-pink-600 dark:text-pink-400",
  facebook: "text-blue-600 dark:text-blue-400",
};
