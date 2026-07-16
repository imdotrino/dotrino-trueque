// Bilingüe es/en (CONVENCIONES §9). Español neutro / tuteo, SIN voseo.
// Lenguaje llano (§9.1): contamos el beneficio, nunca la implementación
// (nada de "proxy", "vault", "pubkey" de cara al usuario).
//
// El idioma lo manda <dotrino-topbar>: él lo persiste en 'dotrino.lang' y avisa
// con el evento 'dotrino-lang'. La app NO tiene toggle ni clave propia; aquí
// solo leemos el mismo criterio para el arranque.

export function detectLang () {
  try {
    const saved = localStorage.getItem('dotrino.lang')
    if (saved === 'es' || saved === 'en') return saved
  } catch (_) {}
  return (navigator.language || 'es').toLowerCase().startsWith('en') ? 'en' : 'es'
}

export const messages = {
  es: {
    // Los tres tipos de anuncio (los ids 'vendo'/'regalo'/'busco' son datos, no se traducen)
    kinds: { vendo: 'Vendo', regalo: 'Regalo', busco: 'Busco' },
    filterAll: 'Todos',

    errors: {
      identity: 'No pudimos abrir tu identidad. Recarga la página e inténtalo de nuevo.',
      noGeo: 'Tu navegador no puede saber dónde estás.',
      geoDenied: 'No nos diste permiso para saber dónde estás. Actívalo para ver anuncios cerca de ti.',
      geoFail: 'No pudimos saber dónde estás.',
      loadPins: 'No pudimos cargar los anuncios.',
      retry: 'Reintentar',
    },

    controls: {
      tagSearch: 'Buscar por etiqueta: bici, comida…',
      radius: 'Radio',
    },

    radar: {
      locating: 'Buscando dónde estás…',
      needLocation: 'Activa la ubicación',
    },

    myPin: {
      expiresIn: (left) => `expira en ${left}`,
      expired: 'expirado',
      remove: 'Retirar',
    },

    list: {
      title: 'Cerca de ti',
      refresh: 'Actualizar',
      noTitle: '(sin título)',
      contact: 'Contactar',
      empty: (radius) => `No hay anuncios en ${radius}. Amplía el radio o publica el primero.`,
    },

    publish: {
      fab: 'Publicar anuncio',
      heading: 'Publicar anuncio',
      title: 'Título',
      titlePh: 'Ej: Bici rodado 26, casi nueva',
      price: 'Precio (opcional)',
      pricePh: 'Ej: $80 / negociable',
      tags: 'Etiquetas (opcional, separadas por coma)',
      tagsPh: 'Ej: bici, rodado26, usado',
      expires: 'Vence en',
      ttl1: '1 hora',
      ttl6: '6 horas',
      ttl24: '24 horas (máx)',
      note: 'Tu anuncio desaparece solo cuando vence. Nadie guarda dónde estás: quien lo vea solo sabe a qué distancia queda y puede escribirte.',
      cancel: 'Cancelar',
      submit: 'Publicar',
      submitting: 'Publicando…',
    },

    contact: {
      heading: 'Contactar',
      about: 'Sobre:',
      seller: 'Vendedor',
      message: 'Mensaje',
      note: 'Le llega a su Messenger, aunque ahora no esté conectado. La conversación sigue ahí.',
      close: 'Cerrar',
      send: 'Enviar',
      sending: 'Enviando…',
      draft: (title) => `Hola, me interesa tu anuncio "${title}".`,
    },

    toast: {
      needTitle: 'Ponle un título al anuncio.',
      needLocation: 'Necesitamos saber dónde estás para publicar.',
      published: 'Anuncio publicado.',
      publishFail: 'No pudimos publicar el anuncio.',
      removed: 'Anuncio retirado.',
      removeFail: 'No pudimos retirar el anuncio.',
      rated: 'Calificación publicada. Gracias.',
      sent: 'Mensaje enviado. Sigue la conversación en Messenger.',
      sendFail: 'No pudimos enviar el mensaje. Inténtalo de nuevo.',
    },
  },

  en: {
    kinds: { vendo: 'For sale', regalo: 'Free', busco: 'Wanted' },
    filterAll: 'All',

    errors: {
      identity: "We couldn't open your identity. Reload the page and try again.",
      noGeo: "Your browser can't tell where you are.",
      geoDenied: "You didn't allow us to know where you are. Turn it on to see listings near you.",
      geoFail: "We couldn't tell where you are.",
      loadPins: "We couldn't load the listings.",
      retry: 'Try again',
    },

    controls: {
      tagSearch: 'Search by tag: bike, food…',
      radius: 'Radius',
    },

    radar: {
      locating: 'Finding where you are…',
      needLocation: 'Turn on location',
    },

    myPin: {
      expiresIn: (left) => `expires in ${left}`,
      expired: 'expired',
      remove: 'Take down',
    },

    list: {
      title: 'Near you',
      refresh: 'Refresh',
      noTitle: '(untitled)',
      contact: 'Get in touch',
      empty: (radius) => `Nothing within ${radius}. Widen the radius or post the first listing.`,
    },

    publish: {
      fab: 'Post a listing',
      heading: 'Post a listing',
      title: 'Title',
      titlePh: 'e.g. 26-inch bike, barely used',
      price: 'Price (optional)',
      pricePh: 'e.g. $80 / or best offer',
      tags: 'Tags (optional, separated by commas)',
      tagsPh: 'e.g. bike, 26inch, used',
      expires: 'Expires in',
      ttl1: '1 hour',
      ttl6: '6 hours',
      ttl24: '24 hours (max)',
      note: 'Your listing disappears by itself when it expires. Nobody stores where you are: people only see how far away it is, and can message you.',
      cancel: 'Cancel',
      submit: 'Post',
      submitting: 'Posting…',
    },

    contact: {
      heading: 'Get in touch',
      about: 'About:',
      seller: 'Seller',
      message: 'Message',
      note: "It reaches their Messenger even if they're offline right now. Carry on the conversation there.",
      close: 'Close',
      send: 'Send',
      sending: 'Sending…',
      draft: (title) => `Hi, I'm interested in your listing "${title}".`,
    },

    toast: {
      needTitle: 'Give your listing a title.',
      needLocation: 'We need to know where you are to post.',
      published: 'Listing posted.',
      publishFail: "We couldn't post your listing.",
      removed: 'Listing taken down.',
      removeFail: "We couldn't take the listing down.",
      rated: 'Rating published. Thank you.',
      sent: 'Message sent. Carry on the conversation in Messenger.',
      sendFail: "We couldn't send your message. Try again.",
    },
  },
}
