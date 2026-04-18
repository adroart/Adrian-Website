import { onRequest as __oracle_universal_language__number__js_onRequest } from "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/Adrian-Website/functions/oracle/universal-language/[number].js"
import { onRequest as __api_keystatic___params___ts_onRequest } from "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/Adrian-Website/functions/api/keystatic/[[params]].ts"
import { onRequestOptions as __api_checkout_js_onRequestOptions } from "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/Adrian-Website/functions/api/checkout.js"
import { onRequestPost as __api_checkout_js_onRequestPost } from "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/Adrian-Website/functions/api/checkout.js"
import { onRequestOptions as __api_inquire_js_onRequestOptions } from "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/Adrian-Website/functions/api/inquire.js"
import { onRequestPost as __api_inquire_js_onRequestPost } from "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/Adrian-Website/functions/api/inquire.js"
import { onRequestOptions as __api_subscribe_js_onRequestOptions } from "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/Adrian-Website/functions/api/subscribe.js"
import { onRequestPost as __api_subscribe_js_onRequestPost } from "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/Adrian-Website/functions/api/subscribe.js"
import { onRequestGet as __api_upload_music_js_onRequestGet } from "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/Adrian-Website/functions/api/upload-music.js"
import { onRequestOptions as __api_upload_music_js_onRequestOptions } from "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/Adrian-Website/functions/api/upload-music.js"
import { onRequestPost as __api_upload_music_js_onRequestPost } from "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/Adrian-Website/functions/api/upload-music.js"
import { onRequest as __qr_oracle_js_onRequest } from "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/Adrian-Website/functions/qr/oracle.js"
import { onRequest as __qr__number__js_onRequest } from "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/Adrian-Website/functions/qr/[number].js"

export const routes = [
    {
      routePath: "/oracle/universal-language/:number",
      mountPath: "/oracle/universal-language",
      method: "",
      middlewares: [],
      modules: [__oracle_universal_language__number__js_onRequest],
    },
  {
      routePath: "/api/keystatic/:params*",
      mountPath: "/api/keystatic",
      method: "",
      middlewares: [],
      modules: [__api_keystatic___params___ts_onRequest],
    },
  {
      routePath: "/api/checkout",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_checkout_js_onRequestOptions],
    },
  {
      routePath: "/api/checkout",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_checkout_js_onRequestPost],
    },
  {
      routePath: "/api/inquire",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_inquire_js_onRequestOptions],
    },
  {
      routePath: "/api/inquire",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_inquire_js_onRequestPost],
    },
  {
      routePath: "/api/subscribe",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_subscribe_js_onRequestOptions],
    },
  {
      routePath: "/api/subscribe",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_subscribe_js_onRequestPost],
    },
  {
      routePath: "/api/upload-music",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_upload_music_js_onRequestGet],
    },
  {
      routePath: "/api/upload-music",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_upload_music_js_onRequestOptions],
    },
  {
      routePath: "/api/upload-music",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_upload_music_js_onRequestPost],
    },
  {
      routePath: "/qr/oracle",
      mountPath: "/qr",
      method: "",
      middlewares: [],
      modules: [__qr_oracle_js_onRequest],
    },
  {
      routePath: "/qr/:number",
      mountPath: "/qr",
      method: "",
      middlewares: [],
      modules: [__qr__number__js_onRequest],
    },
  ]