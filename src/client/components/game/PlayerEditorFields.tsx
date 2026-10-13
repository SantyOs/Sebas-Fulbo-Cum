import type { Dispatch, SetStateAction } from "react";
import {
  CELEBRATIONS,
  HAIRSTYLES,
  SOUNDS,
  type BirthdayProfile,
  type FaceShape,
  type PlayerCustomization,
} from "../../game/customization/profile";
const hairNames = ["Corto", "Rizado", "Cresta", "Largo", "Rapado"];
const celebrationNames = [
  "Brazos arriba",
  "Baile",
  "Dab",
  "Corazón",
  "Avioncito",
  "De rodillas",
  "Arquero",
  "Saludo",
  "Silencio",
  "Puño al cielo",
  "Salto y giro",
];
const soundNames = [
  "Fanfarria + público",
  "Fiesta + público",
  "Ovación",
  "Sin sonido",
];
const faceNames: Record<keyof FaceShape, string> = {
  jaw: "Ancho de mandíbula",
  chin: "Largo del mentón",
  noseWidth: "Ancho de nariz",
  noseLength: "Proyección de nariz",
  eyeSpacing: "Separación de ojos",
  eyeSize: "Apertura de ojos",
  mouthWidth: "Ancho de boca",
  lips: "Volumen de labios",
  ears: "Tamaño de orejas",
  cheeks: "Ancho de pómulos",
};
export const tabs = [
  "Regalo",
  "Identidad",
  "Cara",
  "Apariencia",
  "Atributos",
  "Celebración",
  "Audio",
] as const;
function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="editor-slider">
      <span>
        {label}
        <output>{step === 1 ? value : value.toFixed(2)}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
      />
    </label>
  );
}

export function PlayerEditorFields({
  tab,
  custom,
  draft,
  setDraft,
  update,
  changeCelebration,
  preview,
  upload,
  onDeleteSound,
}: {
  tab: (typeof tabs)[number];
  custom: PlayerCustomization;
  draft: BirthdayProfile;
  setDraft: Dispatch<SetStateAction<BirthdayProfile>>;
  update: (patch: Partial<PlayerCustomization>) => void;
  changeCelebration: (
    patch: Partial<PlayerCustomization["celebration"]>,
  ) => void;
  preview: () => void;
  upload: (file?: File) => Promise<void>;
  onDeleteSound: (id: string) => void;
}) {
  return (
    <div className="editor-form">
      {tab === "Regalo" && (
        <>
          <h3>Una dedicatoria para su día</h3>
          <label>
            Nombre del cumpleañero
            <input
              maxLength={40}
              value={draft.recipient}
              onChange={(e) =>
                setDraft({ ...draft, recipient: e.target.value })
              }
            />
          </label>
          <label>
            Dedicatoria
            <textarea
              maxLength={180}
              value={draft.dedication}
              onChange={(e) =>
                setDraft({ ...draft, dedication: e.target.value })
              }
            />
          </label>
          <Slider
            label="Acercamiento de cámara"
            value={draft.cameraZoom}
            min={1}
            max={1.4}
            onChange={(v) => setDraft({ ...draft, cameraZoom: v })}
          />
          <p>
            1,00 conserva la cámara anterior; 1,18 es el nuevo acercamiento. Se
            aplica en el próximo partido.
          </p>
          <Slider
            label="Volumen general"
            value={draft.volume}
            min={0}
            max={1}
            onChange={(v) => setDraft({ ...draft, volume: v })}
          />
        </>
      )}
      {tab === "Identidad" && (
        <>
          <h3>Su nombre en el campo</h3>
          <label>
            Nombre o apodo
            <input
              maxLength={40}
              value={custom.name}
              onChange={(e) => update({ name: e.target.value })}
            />
          </label>
          <label>
            Dorsal
            <input
              type="number"
              min={1}
              max={99}
              value={custom.num}
              onChange={(e) =>
                update({
                  num: Math.max(1, Math.min(99, +e.target.value)),
                })
              }
            />
          </label>
          <p>
            Los dorsales repetidos se reasignan al guardar. Las posiciones de
            formación se conservan.
          </p>
        </>
      )}
      {tab === "Cara" && (
        <>
          <h3>Esculpe su cara</h3>
          <p>
            Rasgos estilizados del modelo 3D. Usa Frente y Perfil para revisar
            nariz, mandíbula y mentón.
          </p>
          {(Object.keys(faceNames) as (keyof FaceShape)[]).map((feature) => (
            <Slider
              key={feature}
              label={faceNames[feature]}
              value={custom.face[feature]}
              min={0.65}
              max={1.35}
              onChange={(v) =>
                update({ face: { ...custom.face, [feature]: v } })
              }
            />
          ))}
          <Slider
            label="Tamaño de cabeza"
            value={custom.headSize}
            min={0.85}
            max={1.15}
            onChange={(v) => update({ headSize: v })}
          />
          <label>
            Color de ojos
            <input
              type="color"
              value={custom.eyeColor}
              onChange={(e) => update({ eyeColor: e.target.value })}
            />
          </label>
        </>
      )}
      {tab === "Apariencia" && (
        <>
          <h3>Un jugador reconocible</h3>
          <div className="editor-colors">
            {(
              [
                ["skin", "Piel"],
                ["hairColor", "Pelo y barba"],
                ["boots", "Botas"],
                ["wristband", "Muñequeras"],
              ] as const
            ).map(([field, label]) => (
              <label key={field}>
                {label}
                <input
                  type="color"
                  value={custom[field]}
                  onChange={(e) => update({ [field]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <label>
            Peinado
            <select
              value={custom.hairStyle}
              onChange={(e) =>
                update({
                  hairStyle: e.target.value as PlayerCustomization["hairStyle"],
                })
              }
            >
              {HAIRSTYLES.map((h, i) => (
                <option key={h} value={h}>
                  {hairNames[i]}
                </option>
              ))}
            </select>
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={custom.beard}
              onChange={(e) => update({ beard: e.target.checked })}
            />
            Barba
          </label>
          <Slider
            label="Estatura (m)"
            value={custom.height}
            min={1.55}
            max={2.1}
            onChange={(v) => update({ height: v })}
          />
          <Slider
            label="Complexión"
            value={custom.build}
            min={0.75}
            max={1.3}
            onChange={(v) => update({ build: v })}
          />
        </>
      )}
      {tab === "Atributos" && (
        <>
          <h3>Cómo juega</h3>
          <p>
            Estos valores afectan la jugabilidad. La apariencia no cambia las
            colisiones.
          </p>
          {(
            [
              ["pac", "Velocidad"],
              ["sho", "Disparo"],
              ["pas", "Pase"],
              ["dri", "Regate"],
              ["def", "Defensa"],
              ["phy", "Físico"],
            ] as const
          ).map(([attr, label]) => (
            <Slider
              key={attr}
              label={label}
              min={1}
              max={99}
              step={1}
              value={custom.ratings[attr]}
              onChange={(v) =>
                update({ ratings: { ...custom.ratings, [attr]: v } })
              }
            />
          ))}
        </>
      )}
      {tab === "Celebración" && (
        <>
          <h3>Su firma después del gol</h3>
          <label>
            Festejo
            <select
              value={custom.celebration.style}
              onChange={(e) =>
                changeCelebration({
                  style: e.target
                    .value as PlayerCustomization["celebration"]["style"],
                })
              }
            >
              {CELEBRATIONS.map((c, i) => (
                <option key={c} value={c}>
                  {celebrationNames[i]}
                </option>
              ))}
            </select>
          </label>
          <Slider
            label="Velocidad del festejo"
            min={0.6}
            max={1.8}
            value={custom.celebration.speed}
            onChange={(v) => changeCelebration({ speed: v })}
          />
          <Slider
            label="Giros"
            min={0}
            max={1}
            value={custom.celebration.spin}
            onChange={(v) => changeCelebration({ spin: v })}
          />
          <Slider
            label="Salto (m)"
            min={0}
            max={0.6}
            value={custom.celebration.jump}
            onChange={(v) => changeCelebration({ jump: v })}
          />
          <label className="check-label">
            <input
              type="checkbox"
              checked={custom.celebration.closeup !== false}
              onChange={(e) => changeCelebration({ closeup: e.target.checked })}
            />
            Primer plano al marcar
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={custom.celebration.confetti}
              onChange={(e) =>
                changeCelebration({ confetti: e.target.checked })
              }
            />
            Confeti al marcar
          </label>
          <button className="primary-button" onClick={preview}>
            PROBAR FESTEJO Y SONIDO
          </button>
        </>
      )}
      {tab === "Audio" && (
        <>
          <h3>Que se escuche la fiesta</h3>
          <label>
            Sonido de este jugador
            <select
              value={custom.celebration.sound}
              onChange={(e) => changeCelebration({ sound: e.target.value })}
            >
              {SOUNDS.map((s, i) => (
                <option key={s} value={s}>
                  {soundNames[i]}
                </option>
              ))}
              {Object.entries(draft.sounds).map(([id, s]) => (
                <option key={id} value={id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <Slider
            label="Volumen del jugador"
            min={0}
            max={1}
            value={custom.celebration.volume}
            onChange={(v) => changeCelebration({ volume: v })}
          />
          <button className="primary-button" onClick={preview}>
            ESCUCHAR Y VER FESTEJO
          </button>
          <label>
            Subir audio propio
            <input
              type="file"
              accept="audio/mpeg,audio/wav,audio/ogg,audio/webm"
              onChange={(e) => {
                void upload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <p>
            Hasta 4 audios · 1 MB y 30 s por archivo · se reproducen hasta 8 s.
            Se guardan dentro del regalo; no se suben a un servidor.
          </p>
          {Object.entries(draft.sounds).map(([id, s]) => (
            <div className="sound-row" key={id}>
              <span>{s.name}</span>
              <button onClick={() => onDeleteSound(id)}>Eliminar</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
