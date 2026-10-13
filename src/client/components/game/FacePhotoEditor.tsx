import { useEffect, useRef, useState } from "react";
import {
  MAX_FACE_PHOTO,
  photoUrl,
  type FacePhoto,
} from "../../game/customization/photo";

export function FacePhotoEditor({
  photo,
  onChange,
}: {
  photo?: FacePhoto | null;
  onChange: (photo: FacePhoto | null) => void;
}) {
  const [notice, setNotice] = useState("");
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const upload = async (file?: File) => {
    if (!file) return;
    const token = ++generation.current;
    let bitmap: ImageBitmap | undefined;
    try {
      if (
        !/^(image\/jpeg|image\/png|image\/webp)$/.test(file.type) ||
        file.size > 8_000_000
      )
        throw new Error("Usa una foto JPG, PNG o WebP de hasta 8 MB.");
      setNotice("Preparando foto…");
      bitmap = await createImageBitmap(file);
      if (bitmap.width > 8192 || bitmap.height > 8192)
        throw new Error("La imagen supera 8192 píxeles por lado.");
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 512;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No se pudo preparar la foto.");
      const size = Math.min(bitmap.width, bitmap.height);
      ctx.drawImage(
        bitmap,
        (bitmap.width - size) / 2,
        (bitmap.height - size) / 2,
        size,
        size,
        0,
        0,
        512,
        512,
      );
      const source = canvas.toDataURL("image/webp", 0.8);
      if (source.length > MAX_FACE_PHOTO)
        throw new Error(
          "La foto ocupa demasiado. Prueba una imagen más simple o recortada.",
        );
      if (generation.current !== token) return;
      onChange({ source, scale: 1, offsetX: 0.5, offsetY: 0.5, opacity: 1 });
      setNotice(
        "Foto lista. Ajusta el encuadre en la vista 3D y guarda los cambios.",
      );
    } catch (e) {
      if (generation.current === token)
        setNotice(e instanceof Error ? e.message : "No se pudo abrir la foto.");
    } finally {
      bitmap?.close();
    }
  };
  return (
    <fieldset>
      <legend>Foto del rostro</legend>
      <p>
        Usa una foto de frente o un PNG transparente. Ajusta el encuadre para
        alinear ojos y boca.
      </p>
      <label>
        Subir foto{" "}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      {notice && <p role="status">{notice}</p>}
      {photo && (
        <>
          <img
            src={photoUrl(photo.source)}
            alt="Foto de referencia del rostro"
            style={{
              width: 100,
              height: 100,
              objectFit: "contain",
              borderRadius: 8,
            }}
          />
          {(
            [
              ["scale", "Zoom", 0.5, 6],
              ["offsetX", "Centro horizontal", 0, 1],
              ["offsetY", "Centro vertical", 0, 1],
              ["opacity", "Opacidad", 0, 1],
            ] as const
          ).map(([key, label, min, max]) => (
            <label className="editor-slider" key={key}>
              <span>
                {label}
                <output>{photo[key].toFixed(2)}</output>
              </span>
              <input
                type="range"
                min={min}
                max={max}
                step={0.01}
                value={photo[key]}
                onChange={(e) => onChange({ ...photo, [key]: +e.target.value })}
              />
            </label>
          ))}
          <button
            type="button"
            onClick={() => {
              generation.current++;
              onChange(null);
            }}
          >
            Quitar foto
          </button>
        </>
      )}
    </fieldset>
  );
}
