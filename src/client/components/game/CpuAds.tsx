import { useEffect, useState } from "react";
import { birthdayAudio } from "../../game/customization/audio";
import type { BirthdayProfile } from "../../game/customization/profile";

const AD_SECONDS = 7;
const img = (name: string) => `${import.meta.env.BASE_URL}assets/ads/${name}`;

interface Ad {
  theme: string;
  brand: string;
  tag: string;
  title: string;
  body: string;
  bullets: string[];
  price: string;
  cta: string;
  fine: string;
  images: { src: string; label?: string }[];
}

const ADS: Ad[] = [
  {
    theme: "toxic",
    brand: "Grinchito Reborn™",
    tag: "OFERTA EXCLUSIVA SOLO PARA PERDEDORES",
    title: "¡ADOPTA UN GRINCHITO REBORN™!",
    body: "Acabas de recibir un gol de la CPU. Mereces a alguien que te mire así para siempre: con decepción.",
    bullets: [
      "No llora, no come, solo te juzga",
      "Pelo 100 % sintético, como tu defensa",
      "Incluye pijama navideño para usar en octubre",
      "Compatible con tu soledad",
    ],
    price: "Antes $899.900 · HOY $899.899",
    cta: "¡LO QUIERO YA!",
    fine: "Grinchito no incluye amor. Puede contener trazas de rencor. Prohibida su venta a quien sepa defender.",
    images: [{ src: img("grinch.jpg") }],
  },
  {
    theme: "smoke",
    brand: "Préstamos Gota a Gota El Ratón",
    tag: "CRÉDITO PREAPROBADO (PARA TI NO, PERO DALE)",
    title: "¿Te metieron un gol? Te metemos un crédito.",
    body: "Así es la vida, papito. Sin papeles, sin codeudor y sin preguntas. Las preguntas las hacemos después, en moto.",
    bullets: [
      "Aprobación en 3 minutos",
      "Interés del 20 % diario, todo muy transparente",
      "Cobradores con experiencia en dar ánimo",
      "Aceptamos de garantía: el control, el PC o un riñón",
    ],
    price: "Cuota diaria desde $5.000 + IVA + susto",
    cta: "PEDIR PLATA YA",
    fine: "Préstamos El Ratón S.A.S. no responde por rodillas, retrovisores ni dignidades extraviadas. Vigilado por nadie.",
    images: [{ src: img("rata.jpg") }],
  },
  {
    theme: "guru",
    brand: "Academia Sebastian™",
    tag: "MASTERCLASS GRATIS* · CUPOS LIMITADOS",
    title: "Aprende a defender como Sebastian™",
    body: "El único método 100 % comprobado para recibir goles. Lo acabas de comprobar tú mismo.",
    bullets: [
      "Paso 1: sentarse en una piedra del río",
      "Paso 2: hacer la V con las dos manos",
      "Paso 3: ver pasar el balón con una sonrisa",
      "Bono: cómo echarle la culpa al lag",
    ],
    price: "*La primera clase es gratis. Las otras 47 cuestan $1.200.000",
    cta: "INSCRIBIRME AL FRACASO",
    fine: "Resultados no garantizados. Bueno, sí garantizados, pero malos. Sebastian™ no es entrenador certificado, ni de nada.",
    images: [{ src: img("sebas-rio.jpg") }],
  },
  {
    theme: "beauty",
    brand: "GrinchGlow®",
    tag: "LOS DERMATÓLOGOS LO ODIAN",
    title: "Pasa de ESTO a ESTO en solo 7 días",
    body: "Con GrinchGlow® dejarás atrás el verde, el pelo de peluche y la cara de recibir gol. Fórmula con baba de caracol, agua del río y lágrimas de arquero.",
    bullets: [
      "Elimina arrugas de frustración",
      "Reduce el ardor post-derrota",
      "Aplicar cada vez que la CPU te meta uno (o sea, siempre)",
    ],
    price: "3 frascos por $299.900 · el 4.º es un frasco vacío",
    cta: "QUIERO BRILLAR",
    fine: "Imágenes reales de un cliente real. Ninguno de los dos aceptó salir aquí. Uso externo. No untar en el control.",
    images: [
      { src: img("grinch.jpg"), label: "ANTES" },
      { src: img("sebas-v.jpg"), label: "DESPUÉS" },
    ],
  },
  {
    theme: "travel",
    brand: "Charco Tours All Inclusive",
    tag: "TEMPORADA BAJA (COMO TU NIVEL)",
    title: "Vacaciones en la piedra del río: 0 estrellas",
    body: "Ya que no estás haciendo nada en la cancha, ven a no hacer nada en el río. Mira la cara de felicidad de nuestro último cliente.",
    bullets: [
      "Incluye: una piedra",
      "Agua fría ilimitada",
      "Wi-Fi: no. Señal: no. Ganas de vivir: tampoco",
      "Traslado en bus intermunicipal con vallenato a todo volumen",
    ],
    price: "Desde $2.499.900 por persona en acomodación sencilla (la piedra)",
    cta: "RESERVAR MI PIEDRA",
    fine: "Charco Tours no se hace responsable por resbalones, sanguijuelas ni fotos que aparezcan años después en un videojuego.",
    images: [{ src: img("sebas-piedra.jpg") }],
  },
  {
    theme: "boring",
    brand: "Fondo de Pensiones El Mañana Incierto",
    tag: "COMUNICADO INSTITUCIONAL N.º 000473-B",
    title: "Le recordamos que su extracto trimestral está disponible",
    body: "Estimado afiliado: de conformidad con el artículo 4, parágrafo 2, numeral iii del reglamento interno, le informamos que la rentabilidad de su periodo fue de -0,0003 %. Esto obedece a factores macroeconómicos, a la volatilidad de los mercados y a que la CPU le metió un gol.",
    bullets: [
      "Horario de atención: lunes a lunes de 8:00 a 8:05 a. m.",
      "Para radicar una queja, envíe un fax",
      "Tiempo de respuesta: 15 días hábiles por cada letra de su queja",
      "Su asesor asignado: Don Ratón (foto)",
    ],
    price: "Saldo disponible para retiro: $0,00",
    cta: "DESCARGAR EXTRACTO (PDF, 340 PÁGINAS)",
    fine: "Usted probablemente no se pensionará. Gracias por su atención. Gracias por su atención. Gracias por su atención. Gracias por su atención.",
    images: [{ src: img("rata.jpg") }],
  },
];

const BANNERS = [
  {
    text: "🔥 Grinchs solteros en tu zona quieren conocerte",
    src: img("grinch.jpg"),
  },
  {
    text: "Joven de 28 años descubre truco para no recibir goles. Los árbitros lo odian",
    src: img("sebas-v.jpg"),
  },
  {
    text: "Así es la vida, papito 🐀🚬 Haz clic y entérate por qué",
    src: img("rata.jpg"),
  },
  { text: "¡FELICIDADES! Eres el visitante 1.000.000. Reclama tu iPhone 4" },
  { text: "⚠️ Tu PC tiene 37 virus y 1 arquero inútil. LIMPIAR AHORA" },
  {
    text: "¿Te la metieron por abajo? 😳 Curso para aprender a cerrar las piernas (de portero)",
  },
  { text: "Descarga MÁS RAM gratis 💾 100 % real no fake" },
  { text: "Calculadora: cuánto te falta para ser bueno → ∞" },
];

const POPUPS = [
  "⚠️ Tu sesión de dignidad expiró. Vuelve a iniciar sesión.",
  "🔔 ¿Permitir que Fulbo te envíe notificaciones cada 3 minutos?",
  "💬 Grinchito te escribió: «vi ese gol 👀»",
  "🎰 Gira la ruleta y gana otro gol en contra",
];

const TICKER =
  "ÚLTIMA HORA: LA CPU TE HUMILLA · ¡COMPRA YA! · OFERTAS IRREPETIBLES (SE REPITEN EN CADA GOL) · NO CIERRES ESTA VENTANA · ESTE ANUNCIO TE AYUDA A REFLEXIONAR · ASÍ ES LA VIDA, PAPITO · ";

let shown = 0;

export function CpuAds({
  profile,
  onClose,
}: {
  profile: BirthdayProfile;
  onClose: () => void;
}) {
  const [index] = useState(() => shown++);
  const ad = ADS[index % ADS.length];
  const [left, setLeft] = useState(AD_SECONDS),
    [payment, setPayment] = useState(false),
    [round, setRound] = useState(0),
    [notice, setNotice] = useState("");
  useEffect(() => {
    if (payment || left <= 0) return;
    const timer = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [payment, left]);
  // Starts after the match pause has silenced the goal audio.
  useEffect(() => {
    const timer = setTimeout(
      () => birthdayAudio.adJingle(profile, AD_SECONDS),
      250,
    );
    return () => clearTimeout(timer);
  }, [round]);
  useEffect(() => () => birthdayAudio.stop(), []);
  const reject = (message: string) => {
    setPayment(false);
    setNotice(message);
    setLeft(AD_SECONDS);
    setRound((r) => r + 1);
  };
  const banners = [0, 1, 2].map(
    (i) => BANNERS[(index * 3 + i) % BANNERS.length],
  );
  return (
    <div
      className={`cpu-ads ads-${ad.theme}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Publicidad: ${ad.brand}`}
    >
      <div className="ads-ticker" aria-hidden="true">
        <span>{TICKER.repeat(4)}</span>
      </div>
      <div className="ads-stage">
        <article className="ads-main">
          <header>
            <b>{ad.brand}</b>
            <span>Anuncio · 1 de 1 · Patrocinado</span>
          </header>
          <p className="ads-tag">{ad.tag}</p>
          <div className="ads-images">
            {ad.images.map((image) => (
              <figure key={image.src + image.label}>
                <img src={image.src} alt="" />
                {image.label && <figcaption>{image.label}</figcaption>}
              </figure>
            ))}
            <span className="ads-burst" aria-hidden="true">
              -1%
            </span>
          </div>
          <h2>{ad.title}</h2>
          <p>{ad.body}</p>
          <ul>
            {ad.bullets.map((b) => (
              <li key={b}>✅ {b}</li>
            ))}
          </ul>
          <p className="ads-price">{ad.price}</p>
          <button className="ads-cta" onClick={() => setPayment(true)}>
            {ad.cta}
          </button>
          <small>{ad.fine}</small>
        </article>
        <aside className="ads-side" aria-hidden="true">
          {banners.map((banner) => (
            <div className="ads-banner" key={banner.text}>
              {banner.src && <img src={banner.src} alt="" />}
              <span>{banner.text}</span>
            </div>
          ))}
        </aside>
      </div>
      <div className="ads-popups" aria-hidden="true" hidden={payment}>
        {POPUPS.map((text, i) => (
          <div
            key={text}
            className="ads-popup"
            style={{
              animationDelay: `${0.8 + i * 1.4}s`,
              left: `${[6, 58, 18, 64][i]}%`,
              top: `${[22, 14, 64, 58][i]}%`,
            }}
          >
            <i>✕</i>
            {text}
          </div>
        ))}
      </div>
      {notice && (
        <p className="ads-notice" role="alert">
          {notice}
        </p>
      )}
      {left > 0 ? (
        <>
          <span className="ads-countdown" role="status">
            El anuncio termina en {left}
          </span>
          <button
            className="ads-skip"
            autoFocus
            onClick={() => setPayment(true)}
          >
            Omitir anuncio ⏭
          </button>
        </>
      ) : (
        <button
          className="ads-close"
          autoFocus
          onClick={onClose}
          aria-label="Cerrar anuncio"
        >
          ✕
        </button>
      )}
      {payment && (
        <form
          className="ads-pay"
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            reject(
              "Pago rechazado: fondos insuficientes de talento. El anuncio vuelve a empezar.",
            );
          }}
        >
          <h3>Fulbo Premium</h3>
          <p>
            Omite todos los anuncios para siempre por solo <b>$0</b>* hoy.
          </p>
          <label>
            Nombre del titular
            <input autoComplete="off" autoFocus />
          </label>
          <label>
            Número de tarjeta
            <input
              autoComplete="off"
              inputMode="numeric"
              maxLength={19}
              placeholder="0000 0000 0000 0000"
            />
          </label>
          <div className="ads-pay-row">
            <label>
              Vence
              <input autoComplete="off" maxLength={5} placeholder="MM/AA" />
            </label>
            <label>
              CVV
              <input
                autoComplete="off"
                inputMode="numeric"
                maxLength={4}
                type="password"
              />
            </label>
          </div>
          <button type="submit" className="ads-cta">
            Pagar y omitir
          </button>
          <button
            type="button"
            className="ads-pay-cancel"
            onClick={() =>
              reject(
                "Cancelación procesada. Como penalización, el anuncio vuelve a empezar.",
              )
            }
          >
            Cancelar
          </button>
          <small>
            * Luego $49.900 mensuales, débito automático, sin cláusula de
            salida.
          </small>
        </form>
      )}
    </div>
  );
}
