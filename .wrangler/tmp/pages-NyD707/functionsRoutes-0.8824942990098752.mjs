import { onRequestPost as __api_admin_login_js_onRequestPost } from "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/Adrian-Website/functions/api/admin/login.js"
import { onRequestPost as __api_admin_logout_js_onRequestPost } from "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/Adrian-Website/functions/api/admin/logout.js"
import { onRequestGet as __api_admin_verify_js_onRequestGet } from "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/Adrian-Website/functions/api/admin/verify.js"
import { onRequest as __oracle_universal_language__number__js_onRequest } from "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/Adrian-Website/functions/oracle/universal-language/[number].js"
import { onRequest as __api_keystatic___params___ts_onRequest } from "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/Adrian-Website/functions/api/keystatic/[[params]].ts"
import { onRequestOptions as __api_checkout_js_onRequestOptions } from "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/Adrian-Website/functions/api/checkout.js"
import { onRequestPost as __api_checkout_js_onRequestPost } from "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/Adrian-Website/functions/api/checkout.js"
import { onRequestDelete as __api_delete_file_js_onRequestDelete } from "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/Adrian-Website/functions/api/delete-file.js"
import { onRequestOptions as __api_inquire_js_onRequestOptions } from "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/Adrian-Website/functions/api/inquire.js"
import { onRequestPost as __api_inquire_js_onRequestPost } from "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/Adrian-Website/functions/api/inquire.js"
import { onRequestOptions as __api_subscribe_js_onRequestOptions } from "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/Adrian-Website/functions/api/subscribe.js"
import { onRequestPost as __api_subscribe_js_onRequestPost } from "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/Adrian-Website/functions/api/subscribe.js"
import { onRequestGet as __api_upload_music_js_onRequestGet } from "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/Adrian-Website/functions/api/upload-music.js"
import { onRequestPost as __api_upload_music_js_onRequestPost } from "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/Adrian-Website/functions/api/upload-music.js"
import { onRequest as __qr_oracle_js_onRequest } from "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/Adrian-Website/functions/qr/oracle.js"
import { onRequest as __qr__number__js_onRequest } from "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/Adrian-Website/functions/qr/[number].js"

export const routes = [
    {
      routePath: "/api/admin/login",
      mountPath: "/api/admin",
      method: "POST",
      middlewares: [],
      modules: [__api_admin_login_js_onRequestPost],
    },
  {
      routePath: "/api/admin/logout",
      mountPath: "/api/admin",
      method: "POST",
      middlewares: [],
      modules: [__api_admin_logout_js_onRequestPost],
    },
  {
      routePath: "/api/admin/verify",
      mountPath: "/api/admin",
      method: "GET",
      middlewares: [],
      modules: [__api_admin_verify_js_onRequestGet],
    },
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
      routePath: "/api/delete-file",
      mountPath: "/api",
      method: "DELETE",
      middlewares: [],
      modules: [__api_delete_file_js_onRequestDelete],
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