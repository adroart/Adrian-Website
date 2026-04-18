var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// api/admin/login.js
function cookieHeader(value, isSecure) {
  const base = `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000`;
  return isSecure ? `${base}; Secure` : base;
}
async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  if (!body.password || body.password !== env.UPLOAD_SECRET) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const isSecure = new URL(request.url).protocol === "https:";
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookieHeader(env.UPLOAD_SECRET, isSecure)
    }
  });
}
var COOKIE_NAME;
var init_login = __esm({
  "api/admin/login.js"() {
    init_functionsRoutes_0_8824942990098752();
    COOKIE_NAME = "admin_session";
    __name(cookieHeader, "cookieHeader");
    __name(onRequestPost, "onRequestPost");
  }
});

// api/admin/logout.js
async function onRequestPost2({ request }) {
  const isSecure = new URL(request.url).protocol === "https:";
  const cookie2 = `${COOKIE_NAME2}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${isSecure ? "; Secure" : ""}`;
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Set-Cookie": cookie2 }
  });
}
var COOKIE_NAME2;
var init_logout = __esm({
  "api/admin/logout.js"() {
    init_functionsRoutes_0_8824942990098752();
    COOKIE_NAME2 = "admin_session";
    __name(onRequestPost2, "onRequestPost");
  }
});

// api/admin/verify.js
function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  const match2 = header.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return match2 ? match2.slice(name.length + 1) : null;
}
async function onRequestGet({ request, env }) {
  const session = getCookie(request, COOKIE_NAME3);
  const ok = session === env.UPLOAD_SECRET;
  return new Response(JSON.stringify({ ok }), {
    status: ok ? 200 : 401,
    headers: { "Content-Type": "application/json" }
  });
}
var COOKIE_NAME3;
var init_verify = __esm({
  "api/admin/verify.js"() {
    init_functionsRoutes_0_8824942990098752();
    COOKIE_NAME3 = "admin_session";
    __name(getCookie, "getCookie");
    __name(onRequestGet, "onRequestGet");
  }
});

// oracle/universal-language/[number].js
async function onRequest(context) {
  const { params, env, request } = context;
  const num = parseInt(params.number, 10);
  const cardName = CARD_NAMES[num];
  const imageId = CARD_IMAGES[num];
  const indexUrl = new URL(request.url);
  indexUrl.pathname = "/index.html";
  indexUrl.search = "";
  const shell = await env.ASSETS.fetch(new Request(indexUrl.toString(), { method: "GET" }));
  let html = await shell.text();
  if (!cardName || !imageId || isNaN(num)) {
    return new Response(html, { headers: { "content-type": "text/html;charset=UTF-8" } });
  }
  const title = `${cardName} \xB7 Code ${num} \xB7 Universal Language Oracle | Adrian Rasmussen`;
  const description = `Universal Language Oracle card ${num}: ${cardName}. An original airbrushed painting on laser-cut wood by Adrian Rasmussen.`;
  const image3 = `${CLOUDINARY}/${OG_CROP}/${imageId}`;
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`).replace(/(<meta\s+property="og:title"\s+content=")[^"]*"/, `$1${title}"`).replace(/(<meta\s+property="og:description"\s+content=")[^"]*"/, `$1${description}"`).replace(/(<meta\s+property="og:image"\s+content=")[^"]*"/, `$1${image3}"`).replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*"/, `$1${title}"`).replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*"/, `$1${description}"`).replace(/(<meta\s+name="twitter:image"\s+content=")[^"]*"/, `$1${image3}"`);
  return new Response(html, {
    headers: { "content-type": "text/html;charset=UTF-8" }
  });
}
var CLOUDINARY, OG_CROP, CARD_NAMES, CARD_IMAGES;
var init_number = __esm({
  "oracle/universal-language/[number].js"() {
    init_functionsRoutes_0_8824942990098752();
    CLOUDINARY = "https://res.cloudinary.com/dobbosnda/image/upload";
    OG_CROP = "f_auto,q_auto,w_1200,h_630,c_fill,g_auto";
    CARD_NAMES = {
      1: "Earth's Breath",
      2: "Beyond the Shell",
      3: "Messengers of the Infinite",
      4: "Veils of Knowledge",
      5: "The Space Between Time",
      6: "Harmonious Mirage",
      7: "Essential Nexus",
      8: "Odyssey of Freedom",
      9: "Ease in This",
      10: "Internal Treasure",
      11: "Sol Star",
      12: "Petals of Freedom",
      13: "Universal Crest",
      14: "Ancestors Bloom",
      15: "Ordinary Valiance",
      16: "Grand Rising",
      17: "Peral of Christos",
      18: "Liberation of the Greater",
      19: "Solection",
      20: "Emerging as the Code",
      21: "Beyond Binary",
      22: "Treasure of the Way",
      23: "Beneath the Surface",
      24: "Frequency Flutter",
      25: "The Mysteries Play",
      26: "Lighter Than a Feather",
      27: "Inner Majesty",
      28: "Becoming the Mystery",
      29: "All In",
      30: "Sparking the Blaze",
      31: "Theater of Truth",
      32: "Art of Living",
      33: "Echos of Time",
      34: "Sublime Power",
      35: "Navigational Star",
      36: "Crystal Creation",
      37: "Journey Home",
      38: "Inner Light Symphony",
      39: "Nobel Spark",
      40: "Eternal Wellspring",
      41: "Beginning and the End",
      42: "Moving to Perfection",
      43: "Cipher of Knowledge",
      44: "Sophia's Orchestra",
      45: "Tribal Tapestry",
      46: "Fountain of Light",
      47: "Garden of Alchemy",
      48: "Doorways of the Unknown",
      49: "Union in the Ashes",
      50: "Melt Into Perfection",
      51: "Unshakable Arrival",
      52: "Timeless Blossom",
      53: "Creation Oscillation",
      54: "Everlasting Bounty",
      55: "Untouched Perfection",
      56: "Infinite Journey",
      57: "Flight of the Tao",
      58: "Rhythm of Life",
      59: "Mystics Treasures",
      60: "Woven Light",
      61: "Celestial Remembrance",
      62: "Voice of Nature",
      63: "Adornments of Time",
      64: "Communion"
    };
    CARD_IMAGES = {
      1: "1_o8tafh",
      2: "2_kvndyq",
      3: "3_b8iscb",
      4: "4_qesce2",
      5: "5_egctcj",
      6: "6_w1otd0",
      7: "7_bzq8ct",
      8: "8_nff0od",
      9: "9_tjug04",
      10: "10_ozcqlz",
      11: "11_rtesiu",
      12: "12_xjjkon",
      13: "13_citdc4",
      14: "14_l5ufs8",
      15: "15_vozkvv",
      16: "16_dvhi86",
      17: "17_ntlh1k",
      18: "18_kznsph",
      19: "19_imppfd",
      20: "20_e4a4zp",
      21: "21_vxnf0f",
      22: "22_lldo5g",
      23: "23_kbbbt8",
      24: "24_s6sd3e",
      25: "25_aelw6r",
      26: "26_hoyypz",
      27: "27_fxvwyy",
      28: "28_zr859p",
      29: "29_lhj3ug",
      30: "30_fp8gza",
      31: "31_wiywrb",
      32: "32_x9qxas",
      33: "33_nsf6y8",
      34: "34_n1s8hf",
      35: "35_qdtutl",
      36: "36_k8tlcz",
      37: "37_f4zdoz",
      38: "38_rca4zk",
      39: "39_rnqs4x",
      40: "40_zeqgmt",
      41: "41_qlljho",
      42: "42_jb7xjb",
      43: "43_bhjxku",
      44: "44_p9s6o1",
      45: "45_xjnohi",
      46: "46_hqh9va",
      47: "47_oxq0wy",
      48: "48_ttflpq",
      49: "49_xciocz",
      50: "50_g1vs1y",
      51: "51_pdgusl",
      52: "52_farywa",
      53: "53_hai5ju",
      54: "54_m3cjgp",
      55: "55_olyr5l",
      56: "56_boey2k",
      57: "57_ykvrmw",
      58: "58_hsyihd",
      59: "59_braqjq",
      60: "60_eoiule",
      61: "61_o6dqa5",
      62: "62_rtxmo2",
      63: "63_ns8e6p",
      64: "64_lgyp8t"
    };
    __name(onRequest, "onRequest");
  }
});

// ../node_modules/cookie/dist/index.js
var require_dist = __commonJS({
  "../node_modules/cookie/dist/index.js"(exports) {
    "use strict";
    init_functionsRoutes_0_8824942990098752();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.parseCookie = parseCookie;
    exports.parse = parseCookie;
    exports.stringifyCookie = stringifyCookie;
    exports.stringifySetCookie = stringifySetCookie;
    exports.serialize = stringifySetCookie;
    exports.parseSetCookie = parseSetCookie;
    exports.stringifySetCookie = stringifySetCookie;
    exports.serialize = stringifySetCookie;
    var cookieNameRegExp = /^[\u0021-\u003A\u003C\u003E-\u007E]+$/;
    var cookieValueRegExp = /^[\u0021-\u003A\u003C-\u007E]*$/;
    var domainValueRegExp = /^([.]?[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)([.][a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
    var pathValueRegExp = /^[\u0020-\u003A\u003D-\u007E]*$/;
    var maxAgeRegExp = /^-?\d+$/;
    var __toString = Object.prototype.toString;
    var NullObject = /* @__PURE__ */ (() => {
      const C = /* @__PURE__ */ __name(function() {
      }, "C");
      C.prototype = /* @__PURE__ */ Object.create(null);
      return C;
    })();
    function parseCookie(str, options) {
      const obj = new NullObject();
      const len = str.length;
      if (len < 2)
        return obj;
      const dec = options?.decode || decode;
      let index2 = 0;
      do {
        const eqIdx = eqIndex(str, index2, len);
        if (eqIdx === -1)
          break;
        const endIdx = endIndex(str, index2, len);
        if (eqIdx > endIdx) {
          index2 = str.lastIndexOf(";", eqIdx - 1) + 1;
          continue;
        }
        const key = valueSlice(str, index2, eqIdx);
        if (obj[key] === void 0) {
          obj[key] = dec(valueSlice(str, eqIdx + 1, endIdx));
        }
        index2 = endIdx + 1;
      } while (index2 < len);
      return obj;
    }
    __name(parseCookie, "parseCookie");
    function stringifyCookie(cookie2, options) {
      const enc = options?.encode || encodeURIComponent;
      const cookieStrings = [];
      for (const name of Object.keys(cookie2)) {
        const val = cookie2[name];
        if (val === void 0)
          continue;
        if (!cookieNameRegExp.test(name)) {
          throw new TypeError(`cookie name is invalid: ${name}`);
        }
        const value = enc(val);
        if (!cookieValueRegExp.test(value)) {
          throw new TypeError(`cookie val is invalid: ${val}`);
        }
        cookieStrings.push(`${name}=${value}`);
      }
      return cookieStrings.join("; ");
    }
    __name(stringifyCookie, "stringifyCookie");
    function stringifySetCookie(_name, _val, _opts) {
      const cookie2 = typeof _name === "object" ? _name : { ..._opts, name: _name, value: String(_val) };
      const options = typeof _val === "object" ? _val : _opts;
      const enc = options?.encode || encodeURIComponent;
      if (!cookieNameRegExp.test(cookie2.name)) {
        throw new TypeError(`argument name is invalid: ${cookie2.name}`);
      }
      const value = cookie2.value ? enc(cookie2.value) : "";
      if (!cookieValueRegExp.test(value)) {
        throw new TypeError(`argument val is invalid: ${cookie2.value}`);
      }
      let str = cookie2.name + "=" + value;
      if (cookie2.maxAge !== void 0) {
        if (!Number.isInteger(cookie2.maxAge)) {
          throw new TypeError(`option maxAge is invalid: ${cookie2.maxAge}`);
        }
        str += "; Max-Age=" + cookie2.maxAge;
      }
      if (cookie2.domain) {
        if (!domainValueRegExp.test(cookie2.domain)) {
          throw new TypeError(`option domain is invalid: ${cookie2.domain}`);
        }
        str += "; Domain=" + cookie2.domain;
      }
      if (cookie2.path) {
        if (!pathValueRegExp.test(cookie2.path)) {
          throw new TypeError(`option path is invalid: ${cookie2.path}`);
        }
        str += "; Path=" + cookie2.path;
      }
      if (cookie2.expires) {
        if (!isDate(cookie2.expires) || !Number.isFinite(cookie2.expires.valueOf())) {
          throw new TypeError(`option expires is invalid: ${cookie2.expires}`);
        }
        str += "; Expires=" + cookie2.expires.toUTCString();
      }
      if (cookie2.httpOnly) {
        str += "; HttpOnly";
      }
      if (cookie2.secure) {
        str += "; Secure";
      }
      if (cookie2.partitioned) {
        str += "; Partitioned";
      }
      if (cookie2.priority) {
        const priority = typeof cookie2.priority === "string" ? cookie2.priority.toLowerCase() : void 0;
        switch (priority) {
          case "low":
            str += "; Priority=Low";
            break;
          case "medium":
            str += "; Priority=Medium";
            break;
          case "high":
            str += "; Priority=High";
            break;
          default:
            throw new TypeError(`option priority is invalid: ${cookie2.priority}`);
        }
      }
      if (cookie2.sameSite) {
        const sameSite = typeof cookie2.sameSite === "string" ? cookie2.sameSite.toLowerCase() : cookie2.sameSite;
        switch (sameSite) {
          case true:
          case "strict":
            str += "; SameSite=Strict";
            break;
          case "lax":
            str += "; SameSite=Lax";
            break;
          case "none":
            str += "; SameSite=None";
            break;
          default:
            throw new TypeError(`option sameSite is invalid: ${cookie2.sameSite}`);
        }
      }
      return str;
    }
    __name(stringifySetCookie, "stringifySetCookie");
    function parseSetCookie(str, options) {
      const dec = options?.decode || decode;
      const len = str.length;
      const endIdx = endIndex(str, 0, len);
      const eqIdx = eqIndex(str, 0, endIdx);
      const setCookie = eqIdx === -1 ? { name: "", value: dec(valueSlice(str, 0, endIdx)) } : {
        name: valueSlice(str, 0, eqIdx),
        value: dec(valueSlice(str, eqIdx + 1, endIdx))
      };
      let index2 = endIdx + 1;
      while (index2 < len) {
        const endIdx2 = endIndex(str, index2, len);
        const eqIdx2 = eqIndex(str, index2, endIdx2);
        const attr = eqIdx2 === -1 ? valueSlice(str, index2, endIdx2) : valueSlice(str, index2, eqIdx2);
        const val = eqIdx2 === -1 ? void 0 : valueSlice(str, eqIdx2 + 1, endIdx2);
        switch (attr.toLowerCase()) {
          case "httponly":
            setCookie.httpOnly = true;
            break;
          case "secure":
            setCookie.secure = true;
            break;
          case "partitioned":
            setCookie.partitioned = true;
            break;
          case "domain":
            setCookie.domain = val;
            break;
          case "path":
            setCookie.path = val;
            break;
          case "max-age":
            if (val && maxAgeRegExp.test(val))
              setCookie.maxAge = Number(val);
            break;
          case "expires":
            if (!val)
              break;
            const date2 = new Date(val);
            if (Number.isFinite(date2.valueOf()))
              setCookie.expires = date2;
            break;
          case "priority":
            if (!val)
              break;
            const priority = val.toLowerCase();
            if (priority === "low" || priority === "medium" || priority === "high") {
              setCookie.priority = priority;
            }
            break;
          case "samesite":
            if (!val)
              break;
            const sameSite = val.toLowerCase();
            if (sameSite === "lax" || sameSite === "strict" || sameSite === "none") {
              setCookie.sameSite = sameSite;
            }
            break;
        }
        index2 = endIdx2 + 1;
      }
      return setCookie;
    }
    __name(parseSetCookie, "parseSetCookie");
    function endIndex(str, min, len) {
      const index2 = str.indexOf(";", min);
      return index2 === -1 ? len : index2;
    }
    __name(endIndex, "endIndex");
    function eqIndex(str, min, max2) {
      const index2 = str.indexOf("=", min);
      return index2 < max2 ? index2 : -1;
    }
    __name(eqIndex, "eqIndex");
    function valueSlice(str, min, max2) {
      let start = min;
      let end = max2;
      do {
        const code2 = str.charCodeAt(start);
        if (code2 !== 32 && code2 !== 9)
          break;
      } while (++start < end);
      while (end > start) {
        const code2 = str.charCodeAt(end - 1);
        if (code2 !== 32 && code2 !== 9)
          break;
        end--;
      }
      return str.slice(start, end);
    }
    __name(valueSlice, "valueSlice");
    function decode(str) {
      if (str.indexOf("%") === -1)
        return str;
      try {
        return decodeURIComponent(str);
      } catch (e) {
        return str;
      }
    }
    __name(decode, "decode");
    function isDate(val) {
      return __toString.call(val) === "[object Date]";
    }
    __name(isDate, "isDate");
  }
});

// ../node_modules/superstruct/dist/index.mjs
function isIterable(x) {
  return isObject(x) && typeof x[Symbol.iterator] === "function";
}
function isObject(x) {
  return typeof x === "object" && x != null;
}
function print(value) {
  if (typeof value === "symbol") {
    return value.toString();
  }
  return typeof value === "string" ? JSON.stringify(value) : `${value}`;
}
function shiftIterator(input) {
  const { done, value } = input.next();
  return done ? void 0 : value;
}
function toFailure(result, context, struct, value) {
  if (result === true) {
    return;
  } else if (result === false) {
    result = {};
  } else if (typeof result === "string") {
    result = { message: result };
  }
  const { path, branch } = context;
  const { type: type2 } = struct;
  const { refinement, message = `Expected a value of type \`${type2}\`${refinement ? ` with refinement \`${refinement}\`` : ""}, but received: \`${print(value)}\`` } = result;
  return {
    value,
    type: type2,
    refinement,
    key: path[path.length - 1],
    path,
    branch,
    ...result,
    message
  };
}
function* toFailures(result, context, struct, value) {
  if (!isIterable(result)) {
    result = [result];
  }
  for (const r of result) {
    const failure = toFailure(r, context, struct, value);
    if (failure) {
      yield failure;
    }
  }
}
function* run(value, struct, options = {}) {
  const { path = [], branch = [value], coerce = false, mask: mask2 = false } = options;
  const ctx = { path, branch };
  if (coerce) {
    value = struct.coercer(value, ctx);
    if (mask2 && struct.type !== "type" && isObject(struct.schema) && isObject(value) && !Array.isArray(value)) {
      for (const key in value) {
        if (struct.schema[key] === void 0) {
          delete value[key];
        }
      }
    }
  }
  let status = "valid";
  for (const failure of struct.validator(value, ctx)) {
    failure.explanation = options.message;
    status = "not_valid";
    yield [failure, void 0];
  }
  for (let [k, v, s2] of struct.entries(value, ctx)) {
    const ts = run(v, s2, {
      path: k === void 0 ? path : [...path, k],
      branch: k === void 0 ? branch : [...branch, v],
      coerce,
      mask: mask2,
      message: options.message
    });
    for (const t of ts) {
      if (t[0]) {
        status = t[0].refinement != null ? "not_refined" : "not_valid";
        yield [t[0], void 0];
      } else if (coerce) {
        v = t[1];
        if (k === void 0) {
          value = v;
        } else if (value instanceof Map) {
          value.set(k, v);
        } else if (value instanceof Set) {
          value.add(v);
        } else if (isObject(value)) {
          if (v !== void 0 || k in value)
            value[k] = v;
        }
      }
    }
  }
  if (status !== "not_valid") {
    for (const failure of struct.refiner(value, ctx)) {
      failure.explanation = options.message;
      status = "not_refined";
      yield [failure, void 0];
    }
  }
  if (status === "valid") {
    yield [void 0, value];
  }
}
function assert(value, struct, message) {
  const result = validate(value, struct, { message });
  if (result[0]) {
    throw result[0];
  }
}
function create(value, struct, message) {
  const result = validate(value, struct, { coerce: true, message });
  if (result[0]) {
    throw result[0];
  } else {
    return result[1];
  }
}
function mask(value, struct, message) {
  const result = validate(value, struct, { coerce: true, mask: true, message });
  if (result[0]) {
    throw result[0];
  } else {
    return result[1];
  }
}
function is(value, struct) {
  const result = validate(value, struct);
  return !result[0];
}
function validate(value, struct, options = {}) {
  const tuples = run(value, struct, options);
  const tuple = shiftIterator(tuples);
  if (tuple[0]) {
    const error2 = new StructError(tuple[0], function* () {
      for (const t of tuples) {
        if (t[0]) {
          yield t[0];
        }
      }
    });
    return [error2, void 0];
  } else {
    const v = tuple[1];
    return [void 0, v];
  }
}
function define(name, validator2) {
  return new Struct({ type: name, schema: null, validator: validator2 });
}
function literal(constant) {
  const description = print(constant);
  const t = typeof constant;
  return new Struct({
    type: "literal",
    schema: t === "string" || t === "number" || t === "boolean" ? constant : null,
    validator(value) {
      return value === constant || `Expected the literal \`${description}\`, but received: ${print(value)}`;
    }
  });
}
function number() {
  return define("number", (value) => {
    return typeof value === "number" && !isNaN(value) || `Expected a number, but received: ${print(value)}`;
  });
}
function string() {
  return define("string", (value) => {
    return typeof value === "string" || `Expected a string, but received: ${print(value)}`;
  });
}
function type(schema) {
  const keys = Object.keys(schema);
  return new Struct({
    type: "type",
    schema,
    *entries(value) {
      if (isObject(value)) {
        for (const k of keys) {
          yield [k, value[k], schema[k]];
        }
      }
    },
    validator(value) {
      return isObject(value) || `Expected an object, but received: ${print(value)}`;
    },
    coercer(value) {
      return isObject(value) ? { ...value } : value;
    }
  });
}
var StructError, Struct;
var init_dist = __esm({
  "../node_modules/superstruct/dist/index.mjs"() {
    init_functionsRoutes_0_8824942990098752();
    StructError = class extends TypeError {
      static {
        __name(this, "StructError");
      }
      constructor(failure, failures) {
        let cached;
        const { message, explanation, ...rest } = failure;
        const { path } = failure;
        const msg = path.length === 0 ? message : `At path: ${path.join(".")} -- ${message}`;
        super(explanation ?? msg);
        if (explanation != null)
          this.cause = msg;
        Object.assign(this, rest);
        this.name = this.constructor.name;
        this.failures = () => {
          return cached ?? (cached = [failure, ...failures()]);
        };
      }
    };
    __name(isIterable, "isIterable");
    __name(isObject, "isObject");
    __name(print, "print");
    __name(shiftIterator, "shiftIterator");
    __name(toFailure, "toFailure");
    __name(toFailures, "toFailures");
    __name(run, "run");
    Struct = class {
      static {
        __name(this, "Struct");
      }
      constructor(props) {
        const { type: type2, schema, validator: validator2, refiner, coercer = /* @__PURE__ */ __name((value) => value, "coercer"), entries = /* @__PURE__ */ __name(function* () {
        }, "entries") } = props;
        this.type = type2;
        this.schema = schema;
        this.entries = entries;
        this.coercer = coercer;
        if (validator2) {
          this.validator = (value, context) => {
            const result = validator2(value, context);
            return toFailures(result, context, this, value);
          };
        } else {
          this.validator = () => [];
        }
        if (refiner) {
          this.refiner = (value, context) => {
            const result = refiner(value, context);
            return toFailures(result, context, this, value);
          };
        } else {
          this.refiner = () => [];
        }
      }
      /**
       * Assert that a value passes the struct's validation, throwing if it doesn't.
       */
      assert(value, message) {
        return assert(value, this, message);
      }
      /**
       * Create a value with the struct's coercion logic, then validate it.
       */
      create(value, message) {
        return create(value, this, message);
      }
      /**
       * Check if a value passes the struct's validation.
       */
      is(value) {
        return is(value, this);
      }
      /**
       * Mask a value, coercing and validating it, but returning only the subset of
       * properties defined by the struct's schema.
       */
      mask(value, message) {
        return mask(value, this, message);
      }
      /**
       * Validate a value with the struct's validation logic, returning a tuple
       * representing the result.
       *
       * You may optionally pass `true` for the `withCoercion` argument to coerce
       * the value before attempting to validate it. If you do, the result will
       * contain the coerced result when successful.
       */
      validate(value, options = {}) {
        return validate(value, this, options);
      }
    };
    __name(assert, "assert");
    __name(create, "create");
    __name(mask, "mask");
    __name(is, "is");
    __name(validate, "validate");
    __name(define, "define");
    __name(literal, "literal");
    __name(number, "number");
    __name(string, "string");
    __name(type, "type");
  }
});

// ../node_modules/@keystatic/core/dist/keystatic-core-api-generic.worker.js
function bytesToHex(bytes) {
  let str = "";
  for (const byte of bytes) {
    str += byte.toString(16).padStart(2, "0");
  }
  return str;
}
function redirect(to, initialHeaders) {
  return {
    body: null,
    status: 307,
    headers: [...initialHeaders !== null && initialHeaders !== void 0 ? initialHeaders : [], ["Location", to]]
  };
}
function base64UrlDecode(base64) {
  const binString = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binString, (m) => m.codePointAt(0));
}
function base64UrlEncode(bytes) {
  return base64Encode(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function base64Encode(bytes) {
  const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("");
  return btoa(binString);
}
async function deriveKey(secret, salt) {
  if (secret.length < 32) {
    throw new Error("KEYSTATIC_SECRET must be at least 32 characters long");
  }
  const encoded = encoder.encode(secret);
  const key = await webcrypto.subtle.importKey("raw", encoded, "HKDF", false, ["deriveKey"]);
  return webcrypto.subtle.deriveKey({
    name: "HKDF",
    salt,
    hash: "SHA-256",
    info: new Uint8Array(0)
  }, key, {
    name: "AES-GCM",
    length: 256
  }, false, ["encrypt", "decrypt"]);
}
async function encryptValue(value, secret) {
  const salt = webcrypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = webcrypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(secret, salt);
  const encoded = encoder.encode(value);
  const encrypted = await webcrypto.subtle.encrypt({
    name: "AES-GCM",
    iv
  }, key, encoded);
  const full = new Uint8Array(SALT_LENGTH + IV_LENGTH + encrypted.byteLength);
  full.set(salt);
  full.set(iv, SALT_LENGTH);
  full.set(new Uint8Array(encrypted), SALT_LENGTH + IV_LENGTH);
  return base64UrlEncode(full);
}
async function decryptValue(encrypted, secret) {
  const decoded = base64UrlDecode(encrypted);
  const salt = decoded.slice(0, SALT_LENGTH);
  const key = await deriveKey(secret, salt);
  const iv = decoded.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const value = decoded.slice(SALT_LENGTH + IV_LENGTH);
  const decrypted = await webcrypto.subtle.decrypt({
    name: "AES-GCM",
    iv
  }, key, value);
  return decoder.decode(decrypted);
}
function tryOrUndefined(fn) {
  try {
    return fn();
  } catch {
    return void 0;
  }
}
function makeGenericAPIRouteHandler(_config, options) {
  var _config$clientId, _config$clientSecret, _config$secret;
  const _config2 = {
    clientId: (_config$clientId = _config.clientId) !== null && _config$clientId !== void 0 ? _config$clientId : tryOrUndefined(() => process.env.KEYSTATIC_GITHUB_CLIENT_ID),
    clientSecret: (_config$clientSecret = _config.clientSecret) !== null && _config$clientSecret !== void 0 ? _config$clientSecret : tryOrUndefined(() => process.env.KEYSTATIC_GITHUB_CLIENT_SECRET),
    secret: (_config$secret = _config.secret) !== null && _config$secret !== void 0 ? _config$secret : tryOrUndefined(() => process.env.KEYSTATIC_SECRET),
    config: _config.config
  };
  const getParams = /* @__PURE__ */ __name((req) => {
    let url2;
    try {
      url2 = new URL(req.url);
    } catch (err) {
      throw new Error(`Found incomplete URL in Keystatic API route URL handler${(options === null || options === void 0 ? void 0 : options.slugEnvName) === "NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG" ? ". Make sure you're using the latest version of @keystatic/next" : ""}`);
    }
    return url2.pathname.replace(/^\/api\/keystatic\/?/, "").split("/").map((x) => decodeURIComponent(x)).filter(Boolean);
  }, "getParams");
  if (_config2.config.storage.kind === "local") {
    const handler = localModeApiHandler(_config2.config, _config.localBaseDirectory);
    return (req) => {
      const params = getParams(req);
      return handler(req, params);
    };
  }
  if (_config2.config.storage.kind === "cloud") {
    return /* @__PURE__ */ __name(async function keystaticAPIRoute() {
      return {
        status: 404,
        body: "Not Found"
      };
    }, "keystaticAPIRoute");
  }
  if (!_config2.clientId || !_config2.clientSecret || !_config2.secret) {
    if (false) {
      const missingKeys = ["clientId", "clientSecret", "secret"].filter((x) => !_config2[x]);
      throw new Error(`Missing required config in Keystatic API setup when using the 'github' storage mode:
${missingKeys.map((key) => `- ${key} (can be provided via ${keyToEnvVar[key]} env var)`).join("\n")}

If you've created your GitHub app locally, make sure to copy the environment variables from your local env file to your deployed environment`);
    }
    return /* @__PURE__ */ __name(async function keystaticAPIRoute(req) {
      const params = getParams(req);
      const joined = params.join("/");
      if (joined === "github/created-app") {
        return createdGithubApp(req, options === null || options === void 0 ? void 0 : options.slugEnvName);
      }
      if (joined === "github/login" || joined === "github/repo-not-found" || joined === "github/logout") {
        return redirect("/keystatic/setup");
      }
      return {
        status: 404,
        body: "Not Found"
      };
    }, "keystaticAPIRoute");
  }
  const config2 = {
    clientId: _config2.clientId,
    clientSecret: _config2.clientSecret,
    secret: _config2.secret,
    config: _config2.config
  };
  return /* @__PURE__ */ __name(async function keystaticAPIRoute(req) {
    const params = getParams(req);
    const joined = params.join("/");
    if (joined === "github/oauth/callback") {
      return githubOauthCallback(req, config2);
    }
    if (joined === "github/login") {
      return githubLogin(req, config2);
    }
    if (joined === "github/refresh-token") {
      return githubRefreshToken(req, config2);
    }
    if (joined === "github/repo-not-found") {
      return githubRepoNotFound(req, config2);
    }
    if (joined === "github/logout") {
      var _req$headers$get;
      const cookies = cookie.parse((_req$headers$get = req.headers.get("cookie")) !== null && _req$headers$get !== void 0 ? _req$headers$get : "");
      const access_token = cookies["keystatic-gh-access-token"];
      if (access_token) {
        await fetch(`https://api.github.com/applications/${config2.clientId}/token`, {
          method: "DELETE",
          headers: {
            Authorization: `Basic ${btoa(config2.clientId + ":" + config2.clientSecret)}`
          },
          body: JSON.stringify({
            access_token
          })
        });
      }
      return redirect("/keystatic", [["Set-Cookie", immediatelyExpiringCookie("keystatic-gh-access-token")], ["Set-Cookie", immediatelyExpiringCookie("keystatic-gh-refresh-token")]]);
    }
    if (joined === "github/created-app") {
      return {
        status: 404,
        body: "It looks like you just tried to create a GitHub App for Keystatic but there is already a GitHub App configured for Keystatic.\n\nYou may be here because you started creating a GitHub App but then started the process again elsewhere and completed it there. You should likely go back to Keystatic and sign in with GitHub to continue."
      };
    }
    return {
      status: 404,
      body: "Not Found"
    };
  }, "keystaticAPIRoute");
}
async function githubOauthCallback(req, config2) {
  var _req$headers$get2;
  const searchParams = new URL(req.url, "http://localhost").searchParams;
  const error2 = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  if (typeof errorDescription === "string") {
    return {
      status: 400,
      body: `An error occurred when trying to authenticate with GitHub:
${errorDescription}${error2 === "redirect_uri_mismatch" ? `

If you were trying to sign in locally and recently upgraded Keystatic from @keystatic/core@0.0.69 or below, you need to add \`http://127.0.0.1/api/keystatic/github/oauth/callback\` as a callback URL in your GitHub app.` : ""}`
    };
  }
  const code2 = searchParams.get("code");
  const state = searchParams.get("state");
  if (typeof code2 !== "string") {
    return {
      status: 400,
      body: "Bad Request"
    };
  }
  const cookies = cookie.parse((_req$headers$get2 = req.headers.get("cookie")) !== null && _req$headers$get2 !== void 0 ? _req$headers$get2 : "");
  const fromCookie = state ? cookies["ks-" + state] : void 0;
  const from = typeof fromCookie === "string" && keystaticRouteRegex.test(fromCookie) ? fromCookie : void 0;
  const url2 = new URL("https://github.com/login/oauth/access_token");
  url2.searchParams.set("client_id", config2.clientId);
  url2.searchParams.set("client_secret", config2.clientSecret);
  url2.searchParams.set("code", code2);
  const tokenRes = await fetch(url2, {
    method: "POST",
    headers: {
      Accept: "application/json"
    }
  });
  if (!tokenRes.ok) {
    return {
      status: 401,
      body: "Authorization failed"
    };
  }
  const _tokenData = await tokenRes.json();
  let tokenData;
  try {
    tokenData = tokenDataResultType.create(_tokenData);
  } catch {
    return {
      status: 401,
      body: "Authorization failed"
    };
  }
  const headers = await getTokenCookies(tokenData, config2);
  if (state === "close") {
    return {
      headers: [...headers, ["Content-Type", "text/html"]],
      body: "<script>localStorage.setItem('ks-refetch-installations', 'true');window.close();<\/script>",
      status: 200
    };
  }
  return redirect(`/keystatic${from ? `/${from}` : ""}`, headers);
}
async function getTokenCookies(tokenData, config2) {
  const headers = [["Set-Cookie", cookie.serialize("keystatic-gh-access-token", tokenData.access_token, {
    sameSite: "lax",
    secure: false,
    maxAge: tokenData.expires_in,
    expires: new Date(Date.now() + tokenData.expires_in * 1e3),
    path: "/"
  })], ["Set-Cookie", cookie.serialize("keystatic-gh-refresh-token", await encryptValue(tokenData.refresh_token, config2.secret), {
    sameSite: "lax",
    secure: false,
    httpOnly: true,
    maxAge: tokenData.refresh_token_expires_in,
    expires: new Date(Date.now() + tokenData.refresh_token_expires_in * 100),
    path: "/"
  })]];
  return headers;
}
async function getRefreshToken(req, config2) {
  const cookies = cookie.parse(req.headers.get("cookie") || "");
  const refreshTokenCookie = cookies["keystatic-gh-refresh-token"];
  if (!refreshTokenCookie) return;
  let refreshToken;
  try {
    refreshToken = await decryptValue(refreshTokenCookie, config2.secret);
  } catch {
    return;
  }
  return refreshToken;
}
async function githubRefreshToken(req, config2) {
  const headers = await refreshGitHubAuth(req, config2);
  if (!headers) {
    return {
      status: 401,
      body: "Authorization failed"
    };
  }
  return {
    status: 200,
    headers,
    body: ""
  };
}
async function refreshGitHubAuth(req, config2) {
  const refreshToken = await getRefreshToken(req, config2);
  if (!refreshToken) {
    return;
  }
  const url2 = new URL("https://github.com/login/oauth/access_token");
  url2.searchParams.set("client_id", config2.clientId);
  url2.searchParams.set("client_secret", config2.clientSecret);
  url2.searchParams.set("grant_type", "refresh_token");
  url2.searchParams.set("refresh_token", refreshToken);
  const tokenRes = await fetch(url2, {
    method: "POST",
    headers: {
      Accept: "application/json"
    }
  });
  if (!tokenRes.ok) {
    return;
  }
  const _tokenData = await tokenRes.json();
  let tokenData;
  try {
    tokenData = tokenDataResultType.create(_tokenData);
  } catch {
    return;
  }
  return getTokenCookies(tokenData, config2);
}
async function githubRepoNotFound(req, config2) {
  const headers = await refreshGitHubAuth(req, config2);
  if (headers) {
    return redirect("/keystatic/repo-not-found", headers);
  }
  return githubLogin(req, config2);
}
async function githubLogin(req, config2) {
  const reqUrl = new URL(req.url);
  const rawFrom = reqUrl.searchParams.get("from");
  const from = typeof rawFrom === "string" && keystaticRouteRegex.test(rawFrom) ? rawFrom : "/";
  const state = bytesToHex(webcrypto.getRandomValues(new Uint8Array(10)));
  const url2 = new URL("https://github.com/login/oauth/authorize");
  url2.searchParams.set("client_id", config2.clientId);
  url2.searchParams.set("redirect_uri", `${reqUrl.origin}/api/keystatic/github/oauth/callback`);
  if (from === "/") {
    return redirect(url2.toString());
  }
  url2.searchParams.set("state", state);
  return redirect(url2.toString(), [["Set-Cookie", cookie.serialize("ks-" + state, from, {
    sameSite: "lax",
    secure: false,
    // 1 day
    maxAge: 60 * 60 * 24,
    expires: new Date(Date.now() + 60 * 60 * 24 * 1e3),
    path: "/",
    httpOnly: true
  })]]);
}
async function createdGithubApp(req, slugEnvVarName) {
  if (false) {
    return {
      status: 400,
      body: "App setup only allowed in development"
    };
  }
  return handleGitHubAppCreation();
}
function immediatelyExpiringCookie(name) {
  return cookie.serialize(name, "", {
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: /* @__PURE__ */ new Date()
  });
}
var cookie, localModeApiHandler, handleGitHubAppCreation, webcrypto, encoder, decoder, SALT_LENGTH, IV_LENGTH, keystaticRouteRegex, tokenDataResultType;
var init_keystatic_core_api_generic_worker = __esm({
  "../node_modules/@keystatic/core/dist/keystatic-core-api-generic.worker.js"() {
    init_functionsRoutes_0_8824942990098752();
    cookie = __toESM(require_dist(), 1);
    init_dist();
    __name(bytesToHex, "bytesToHex");
    __name(redirect, "redirect");
    localModeApiHandler = /* @__PURE__ */ __name(() => async () => ({
      status: 500,
      body: "The Keystatic API route is running in a non-Node.js environment which is not supported with `storage: { kind: 'local' }`"
    }), "localModeApiHandler");
    handleGitHubAppCreation = /* @__PURE__ */ __name(async () => ({
      status: 500,
      body: "The Keystatic API route is running in a non-Node.js environment which does not support GitHub App creation"
    }), "handleGitHubAppCreation");
    webcrypto = crypto;
    __name(base64UrlDecode, "base64UrlDecode");
    __name(base64UrlEncode, "base64UrlEncode");
    __name(base64Encode, "base64Encode");
    encoder = new TextEncoder();
    decoder = new TextDecoder();
    __name(deriveKey, "deriveKey");
    SALT_LENGTH = 16;
    IV_LENGTH = 12;
    __name(encryptValue, "encryptValue");
    __name(decryptValue, "decryptValue");
    keystaticRouteRegex = /^branch\/[^]+(\/collection\/[^/]+(|\/(create|item\/[^/]+))|\/singleton\/[^/]+)?$/;
    __name(tryOrUndefined, "tryOrUndefined");
    __name(makeGenericAPIRouteHandler, "makeGenericAPIRouteHandler");
    tokenDataResultType = type({
      access_token: string(),
      expires_in: number(),
      refresh_token: string(),
      refresh_token_expires_in: number(),
      scope: string(),
      token_type: literal("bearer")
    });
    __name(githubOauthCallback, "githubOauthCallback");
    __name(getTokenCookies, "getTokenCookies");
    __name(getRefreshToken, "getRefreshToken");
    __name(githubRefreshToken, "githubRefreshToken");
    __name(refreshGitHubAuth, "refreshGitHubAuth");
    __name(githubRepoNotFound, "githubRepoNotFound");
    __name(githubLogin, "githubLogin");
    __name(createdGithubApp, "createdGithubApp");
    __name(immediatelyExpiringCookie, "immediatelyExpiringCookie");
  }
});

// ../node_modules/react/cjs/react.development.js
var require_react_development = __commonJS({
  "../node_modules/react/cjs/react.development.js"(exports, module) {
    "use strict";
    init_functionsRoutes_0_8824942990098752();
    if (true) {
      (function() {
        "use strict";
        if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart === "function") {
          __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(new Error());
        }
        var ReactVersion = "18.3.1";
        var REACT_ELEMENT_TYPE = Symbol.for("react.element");
        var REACT_PORTAL_TYPE = Symbol.for("react.portal");
        var REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
        var REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode");
        var REACT_PROFILER_TYPE = Symbol.for("react.profiler");
        var REACT_PROVIDER_TYPE = Symbol.for("react.provider");
        var REACT_CONTEXT_TYPE = Symbol.for("react.context");
        var REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref");
        var REACT_SUSPENSE_TYPE = Symbol.for("react.suspense");
        var REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list");
        var REACT_MEMO_TYPE = Symbol.for("react.memo");
        var REACT_LAZY_TYPE = Symbol.for("react.lazy");
        var REACT_OFFSCREEN_TYPE = Symbol.for("react.offscreen");
        var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
        var FAUX_ITERATOR_SYMBOL = "@@iterator";
        function getIteratorFn(maybeIterable) {
          if (maybeIterable === null || typeof maybeIterable !== "object") {
            return null;
          }
          var maybeIterator = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL];
          if (typeof maybeIterator === "function") {
            return maybeIterator;
          }
          return null;
        }
        __name(getIteratorFn, "getIteratorFn");
        var ReactCurrentDispatcher = {
          /**
           * @internal
           * @type {ReactComponent}
           */
          current: null
        };
        var ReactCurrentBatchConfig = {
          transition: null
        };
        var ReactCurrentActQueue = {
          current: null,
          // Used to reproduce behavior of `batchedUpdates` in legacy mode.
          isBatchingLegacy: false,
          didScheduleLegacyUpdate: false
        };
        var ReactCurrentOwner = {
          /**
           * @internal
           * @type {ReactComponent}
           */
          current: null
        };
        var ReactDebugCurrentFrame = {};
        var currentExtraStackFrame = null;
        function setExtraStackFrame(stack) {
          {
            currentExtraStackFrame = stack;
          }
        }
        __name(setExtraStackFrame, "setExtraStackFrame");
        {
          ReactDebugCurrentFrame.setExtraStackFrame = function(stack) {
            {
              currentExtraStackFrame = stack;
            }
          };
          ReactDebugCurrentFrame.getCurrentStack = null;
          ReactDebugCurrentFrame.getStackAddendum = function() {
            var stack = "";
            if (currentExtraStackFrame) {
              stack += currentExtraStackFrame;
            }
            var impl = ReactDebugCurrentFrame.getCurrentStack;
            if (impl) {
              stack += impl() || "";
            }
            return stack;
          };
        }
        var enableScopeAPI = false;
        var enableCacheElement = false;
        var enableTransitionTracing = false;
        var enableLegacyHidden = false;
        var enableDebugTracing = false;
        var ReactSharedInternals = {
          ReactCurrentDispatcher,
          ReactCurrentBatchConfig,
          ReactCurrentOwner
        };
        {
          ReactSharedInternals.ReactDebugCurrentFrame = ReactDebugCurrentFrame;
          ReactSharedInternals.ReactCurrentActQueue = ReactCurrentActQueue;
        }
        function warn(format2) {
          {
            {
              for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
                args[_key - 1] = arguments[_key];
              }
              printWarning("warn", format2, args);
            }
          }
        }
        __name(warn, "warn");
        function error2(format2) {
          {
            {
              for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
                args[_key2 - 1] = arguments[_key2];
              }
              printWarning("error", format2, args);
            }
          }
        }
        __name(error2, "error");
        function printWarning(level, format2, args) {
          {
            var ReactDebugCurrentFrame2 = ReactSharedInternals.ReactDebugCurrentFrame;
            var stack = ReactDebugCurrentFrame2.getStackAddendum();
            if (stack !== "") {
              format2 += "%s";
              args = args.concat([stack]);
            }
            var argsWithFormat = args.map(function(item2) {
              return String(item2);
            });
            argsWithFormat.unshift("Warning: " + format2);
            Function.prototype.apply.call(console[level], console, argsWithFormat);
          }
        }
        __name(printWarning, "printWarning");
        var didWarnStateUpdateForUnmountedComponent = {};
        function warnNoop(publicInstance, callerName) {
          {
            var _constructor = publicInstance.constructor;
            var componentName = _constructor && (_constructor.displayName || _constructor.name) || "ReactClass";
            var warningKey = componentName + "." + callerName;
            if (didWarnStateUpdateForUnmountedComponent[warningKey]) {
              return;
            }
            error2("Can't call %s on a component that is not yet mounted. This is a no-op, but it might indicate a bug in your application. Instead, assign to `this.state` directly or define a `state = {};` class property with the desired state in the %s component.", callerName, componentName);
            didWarnStateUpdateForUnmountedComponent[warningKey] = true;
          }
        }
        __name(warnNoop, "warnNoop");
        var ReactNoopUpdateQueue = {
          /**
           * Checks whether or not this composite component is mounted.
           * @param {ReactClass} publicInstance The instance we want to test.
           * @return {boolean} True if mounted, false otherwise.
           * @protected
           * @final
           */
          isMounted: /* @__PURE__ */ __name(function(publicInstance) {
            return false;
          }, "isMounted"),
          /**
           * Forces an update. This should only be invoked when it is known with
           * certainty that we are **not** in a DOM transaction.
           *
           * You may want to call this when you know that some deeper aspect of the
           * component's state has changed but `setState` was not called.
           *
           * This will not invoke `shouldComponentUpdate`, but it will invoke
           * `componentWillUpdate` and `componentDidUpdate`.
           *
           * @param {ReactClass} publicInstance The instance that should rerender.
           * @param {?function} callback Called after component is updated.
           * @param {?string} callerName name of the calling function in the public API.
           * @internal
           */
          enqueueForceUpdate: /* @__PURE__ */ __name(function(publicInstance, callback, callerName) {
            warnNoop(publicInstance, "forceUpdate");
          }, "enqueueForceUpdate"),
          /**
           * Replaces all of the state. Always use this or `setState` to mutate state.
           * You should treat `this.state` as immutable.
           *
           * There is no guarantee that `this.state` will be immediately updated, so
           * accessing `this.state` after calling this method may return the old value.
           *
           * @param {ReactClass} publicInstance The instance that should rerender.
           * @param {object} completeState Next state.
           * @param {?function} callback Called after component is updated.
           * @param {?string} callerName name of the calling function in the public API.
           * @internal
           */
          enqueueReplaceState: /* @__PURE__ */ __name(function(publicInstance, completeState, callback, callerName) {
            warnNoop(publicInstance, "replaceState");
          }, "enqueueReplaceState"),
          /**
           * Sets a subset of the state. This only exists because _pendingState is
           * internal. This provides a merging strategy that is not available to deep
           * properties which is confusing. TODO: Expose pendingState or don't use it
           * during the merge.
           *
           * @param {ReactClass} publicInstance The instance that should rerender.
           * @param {object} partialState Next partial state to be merged with state.
           * @param {?function} callback Called after component is updated.
           * @param {?string} Name of the calling function in the public API.
           * @internal
           */
          enqueueSetState: /* @__PURE__ */ __name(function(publicInstance, partialState, callback, callerName) {
            warnNoop(publicInstance, "setState");
          }, "enqueueSetState")
        };
        var assign = Object.assign;
        var emptyObject = {};
        {
          Object.freeze(emptyObject);
        }
        function Component(props, context, updater) {
          this.props = props;
          this.context = context;
          this.refs = emptyObject;
          this.updater = updater || ReactNoopUpdateQueue;
        }
        __name(Component, "Component");
        Component.prototype.isReactComponent = {};
        Component.prototype.setState = function(partialState, callback) {
          if (typeof partialState !== "object" && typeof partialState !== "function" && partialState != null) {
            throw new Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
          }
          this.updater.enqueueSetState(this, partialState, callback, "setState");
        };
        Component.prototype.forceUpdate = function(callback) {
          this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
        };
        {
          var deprecatedAPIs = {
            isMounted: ["isMounted", "Instead, make sure to clean up subscriptions and pending requests in componentWillUnmount to prevent memory leaks."],
            replaceState: ["replaceState", "Refactor your code to use setState instead (see https://github.com/facebook/react/issues/3236)."]
          };
          var defineDeprecationWarning = /* @__PURE__ */ __name(function(methodName, info) {
            Object.defineProperty(Component.prototype, methodName, {
              get: /* @__PURE__ */ __name(function() {
                warn("%s(...) is deprecated in plain JavaScript React classes. %s", info[0], info[1]);
                return void 0;
              }, "get")
            });
          }, "defineDeprecationWarning");
          for (var fnName in deprecatedAPIs) {
            if (deprecatedAPIs.hasOwnProperty(fnName)) {
              defineDeprecationWarning(fnName, deprecatedAPIs[fnName]);
            }
          }
        }
        function ComponentDummy() {
        }
        __name(ComponentDummy, "ComponentDummy");
        ComponentDummy.prototype = Component.prototype;
        function PureComponent(props, context, updater) {
          this.props = props;
          this.context = context;
          this.refs = emptyObject;
          this.updater = updater || ReactNoopUpdateQueue;
        }
        __name(PureComponent, "PureComponent");
        var pureComponentPrototype = PureComponent.prototype = new ComponentDummy();
        pureComponentPrototype.constructor = PureComponent;
        assign(pureComponentPrototype, Component.prototype);
        pureComponentPrototype.isPureReactComponent = true;
        function createRef() {
          var refObject = {
            current: null
          };
          {
            Object.seal(refObject);
          }
          return refObject;
        }
        __name(createRef, "createRef");
        var isArrayImpl = Array.isArray;
        function isArray(a) {
          return isArrayImpl(a);
        }
        __name(isArray, "isArray");
        function typeName(value) {
          {
            var hasToStringTag = typeof Symbol === "function" && Symbol.toStringTag;
            var type2 = hasToStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
            return type2;
          }
        }
        __name(typeName, "typeName");
        function willCoercionThrow(value) {
          {
            try {
              testStringCoercion(value);
              return false;
            } catch (e) {
              return true;
            }
          }
        }
        __name(willCoercionThrow, "willCoercionThrow");
        function testStringCoercion(value) {
          return "" + value;
        }
        __name(testStringCoercion, "testStringCoercion");
        function checkKeyStringCoercion(value) {
          {
            if (willCoercionThrow(value)) {
              error2("The provided key is an unsupported type %s. This value must be coerced to a string before before using it here.", typeName(value));
              return testStringCoercion(value);
            }
          }
        }
        __name(checkKeyStringCoercion, "checkKeyStringCoercion");
        function getWrappedName(outerType, innerType, wrapperName) {
          var displayName = outerType.displayName;
          if (displayName) {
            return displayName;
          }
          var functionName = innerType.displayName || innerType.name || "";
          return functionName !== "" ? wrapperName + "(" + functionName + ")" : wrapperName;
        }
        __name(getWrappedName, "getWrappedName");
        function getContextName(type2) {
          return type2.displayName || "Context";
        }
        __name(getContextName, "getContextName");
        function getComponentNameFromType(type2) {
          if (type2 == null) {
            return null;
          }
          {
            if (typeof type2.tag === "number") {
              error2("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue.");
            }
          }
          if (typeof type2 === "function") {
            return type2.displayName || type2.name || null;
          }
          if (typeof type2 === "string") {
            return type2;
          }
          switch (type2) {
            case REACT_FRAGMENT_TYPE:
              return "Fragment";
            case REACT_PORTAL_TYPE:
              return "Portal";
            case REACT_PROFILER_TYPE:
              return "Profiler";
            case REACT_STRICT_MODE_TYPE:
              return "StrictMode";
            case REACT_SUSPENSE_TYPE:
              return "Suspense";
            case REACT_SUSPENSE_LIST_TYPE:
              return "SuspenseList";
          }
          if (typeof type2 === "object") {
            switch (type2.$$typeof) {
              case REACT_CONTEXT_TYPE:
                var context = type2;
                return getContextName(context) + ".Consumer";
              case REACT_PROVIDER_TYPE:
                var provider = type2;
                return getContextName(provider._context) + ".Provider";
              case REACT_FORWARD_REF_TYPE:
                return getWrappedName(type2, type2.render, "ForwardRef");
              case REACT_MEMO_TYPE:
                var outerName = type2.displayName || null;
                if (outerName !== null) {
                  return outerName;
                }
                return getComponentNameFromType(type2.type) || "Memo";
              case REACT_LAZY_TYPE: {
                var lazyComponent = type2;
                var payload = lazyComponent._payload;
                var init = lazyComponent._init;
                try {
                  return getComponentNameFromType(init(payload));
                } catch (x) {
                  return null;
                }
              }
            }
          }
          return null;
        }
        __name(getComponentNameFromType, "getComponentNameFromType");
        var hasOwnProperty = Object.prototype.hasOwnProperty;
        var RESERVED_PROPS = {
          key: true,
          ref: true,
          __self: true,
          __source: true
        };
        var specialPropKeyWarningShown, specialPropRefWarningShown, didWarnAboutStringRefs;
        {
          didWarnAboutStringRefs = {};
        }
        function hasValidRef(config2) {
          {
            if (hasOwnProperty.call(config2, "ref")) {
              var getter = Object.getOwnPropertyDescriptor(config2, "ref").get;
              if (getter && getter.isReactWarning) {
                return false;
              }
            }
          }
          return config2.ref !== void 0;
        }
        __name(hasValidRef, "hasValidRef");
        function hasValidKey(config2) {
          {
            if (hasOwnProperty.call(config2, "key")) {
              var getter = Object.getOwnPropertyDescriptor(config2, "key").get;
              if (getter && getter.isReactWarning) {
                return false;
              }
            }
          }
          return config2.key !== void 0;
        }
        __name(hasValidKey, "hasValidKey");
        function defineKeyPropWarningGetter(props, displayName) {
          var warnAboutAccessingKey = /* @__PURE__ */ __name(function() {
            {
              if (!specialPropKeyWarningShown) {
                specialPropKeyWarningShown = true;
                error2("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", displayName);
              }
            }
          }, "warnAboutAccessingKey");
          warnAboutAccessingKey.isReactWarning = true;
          Object.defineProperty(props, "key", {
            get: warnAboutAccessingKey,
            configurable: true
          });
        }
        __name(defineKeyPropWarningGetter, "defineKeyPropWarningGetter");
        function defineRefPropWarningGetter(props, displayName) {
          var warnAboutAccessingRef = /* @__PURE__ */ __name(function() {
            {
              if (!specialPropRefWarningShown) {
                specialPropRefWarningShown = true;
                error2("%s: `ref` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", displayName);
              }
            }
          }, "warnAboutAccessingRef");
          warnAboutAccessingRef.isReactWarning = true;
          Object.defineProperty(props, "ref", {
            get: warnAboutAccessingRef,
            configurable: true
          });
        }
        __name(defineRefPropWarningGetter, "defineRefPropWarningGetter");
        function warnIfStringRefCannotBeAutoConverted(config2) {
          {
            if (typeof config2.ref === "string" && ReactCurrentOwner.current && config2.__self && ReactCurrentOwner.current.stateNode !== config2.__self) {
              var componentName = getComponentNameFromType(ReactCurrentOwner.current.type);
              if (!didWarnAboutStringRefs[componentName]) {
                error2('Component "%s" contains the string ref "%s". Support for string refs will be removed in a future major release. This case cannot be automatically converted to an arrow function. We ask you to manually fix this case by using useRef() or createRef() instead. Learn more about using refs safely here: https://reactjs.org/link/strict-mode-string-ref', componentName, config2.ref);
                didWarnAboutStringRefs[componentName] = true;
              }
            }
          }
        }
        __name(warnIfStringRefCannotBeAutoConverted, "warnIfStringRefCannotBeAutoConverted");
        var ReactElement = /* @__PURE__ */ __name(function(type2, key, ref, self, source, owner, props) {
          var element = {
            // This tag allows us to uniquely identify this as a React Element
            $$typeof: REACT_ELEMENT_TYPE,
            // Built-in properties that belong on the element
            type: type2,
            key,
            ref,
            props,
            // Record the component responsible for creating this element.
            _owner: owner
          };
          {
            element._store = {};
            Object.defineProperty(element._store, "validated", {
              configurable: false,
              enumerable: false,
              writable: true,
              value: false
            });
            Object.defineProperty(element, "_self", {
              configurable: false,
              enumerable: false,
              writable: false,
              value: self
            });
            Object.defineProperty(element, "_source", {
              configurable: false,
              enumerable: false,
              writable: false,
              value: source
            });
            if (Object.freeze) {
              Object.freeze(element.props);
              Object.freeze(element);
            }
          }
          return element;
        }, "ReactElement");
        function createElement2(type2, config2, children) {
          var propName;
          var props = {};
          var key = null;
          var ref = null;
          var self = null;
          var source = null;
          if (config2 != null) {
            if (hasValidRef(config2)) {
              ref = config2.ref;
              {
                warnIfStringRefCannotBeAutoConverted(config2);
              }
            }
            if (hasValidKey(config2)) {
              {
                checkKeyStringCoercion(config2.key);
              }
              key = "" + config2.key;
            }
            self = config2.__self === void 0 ? null : config2.__self;
            source = config2.__source === void 0 ? null : config2.__source;
            for (propName in config2) {
              if (hasOwnProperty.call(config2, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
                props[propName] = config2[propName];
              }
            }
          }
          var childrenLength = arguments.length - 2;
          if (childrenLength === 1) {
            props.children = children;
          } else if (childrenLength > 1) {
            var childArray = Array(childrenLength);
            for (var i = 0; i < childrenLength; i++) {
              childArray[i] = arguments[i + 2];
            }
            {
              if (Object.freeze) {
                Object.freeze(childArray);
              }
            }
            props.children = childArray;
          }
          if (type2 && type2.defaultProps) {
            var defaultProps = type2.defaultProps;
            for (propName in defaultProps) {
              if (props[propName] === void 0) {
                props[propName] = defaultProps[propName];
              }
            }
          }
          {
            if (key || ref) {
              var displayName = typeof type2 === "function" ? type2.displayName || type2.name || "Unknown" : type2;
              if (key) {
                defineKeyPropWarningGetter(props, displayName);
              }
              if (ref) {
                defineRefPropWarningGetter(props, displayName);
              }
            }
          }
          return ReactElement(type2, key, ref, self, source, ReactCurrentOwner.current, props);
        }
        __name(createElement2, "createElement");
        function cloneAndReplaceKey(oldElement, newKey) {
          var newElement = ReactElement(oldElement.type, newKey, oldElement.ref, oldElement._self, oldElement._source, oldElement._owner, oldElement.props);
          return newElement;
        }
        __name(cloneAndReplaceKey, "cloneAndReplaceKey");
        function cloneElement(element, config2, children) {
          if (element === null || element === void 0) {
            throw new Error("React.cloneElement(...): The argument must be a React element, but you passed " + element + ".");
          }
          var propName;
          var props = assign({}, element.props);
          var key = element.key;
          var ref = element.ref;
          var self = element._self;
          var source = element._source;
          var owner = element._owner;
          if (config2 != null) {
            if (hasValidRef(config2)) {
              ref = config2.ref;
              owner = ReactCurrentOwner.current;
            }
            if (hasValidKey(config2)) {
              {
                checkKeyStringCoercion(config2.key);
              }
              key = "" + config2.key;
            }
            var defaultProps;
            if (element.type && element.type.defaultProps) {
              defaultProps = element.type.defaultProps;
            }
            for (propName in config2) {
              if (hasOwnProperty.call(config2, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
                if (config2[propName] === void 0 && defaultProps !== void 0) {
                  props[propName] = defaultProps[propName];
                } else {
                  props[propName] = config2[propName];
                }
              }
            }
          }
          var childrenLength = arguments.length - 2;
          if (childrenLength === 1) {
            props.children = children;
          } else if (childrenLength > 1) {
            var childArray = Array(childrenLength);
            for (var i = 0; i < childrenLength; i++) {
              childArray[i] = arguments[i + 2];
            }
            props.children = childArray;
          }
          return ReactElement(element.type, key, ref, self, source, owner, props);
        }
        __name(cloneElement, "cloneElement");
        function isValidElement(object2) {
          return typeof object2 === "object" && object2 !== null && object2.$$typeof === REACT_ELEMENT_TYPE;
        }
        __name(isValidElement, "isValidElement");
        var SEPARATOR = ".";
        var SUBSEPARATOR = ":";
        function escape(key) {
          var escapeRegex2 = /[=:]/g;
          var escaperLookup = {
            "=": "=0",
            ":": "=2"
          };
          var escapedString = key.replace(escapeRegex2, function(match2) {
            return escaperLookup[match2];
          });
          return "$" + escapedString;
        }
        __name(escape, "escape");
        var didWarnAboutMaps = false;
        var userProvidedKeyEscapeRegex = /\/+/g;
        function escapeUserProvidedKey(text3) {
          return text3.replace(userProvidedKeyEscapeRegex, "$&/");
        }
        __name(escapeUserProvidedKey, "escapeUserProvidedKey");
        function getElementKey(element, index2) {
          if (typeof element === "object" && element !== null && element.key != null) {
            {
              checkKeyStringCoercion(element.key);
            }
            return escape("" + element.key);
          }
          return index2.toString(36);
        }
        __name(getElementKey, "getElementKey");
        function mapIntoArray(children, array2, escapedPrefix, nameSoFar, callback) {
          var type2 = typeof children;
          if (type2 === "undefined" || type2 === "boolean") {
            children = null;
          }
          var invokeCallback = false;
          if (children === null) {
            invokeCallback = true;
          } else {
            switch (type2) {
              case "string":
              case "number":
                invokeCallback = true;
                break;
              case "object":
                switch (children.$$typeof) {
                  case REACT_ELEMENT_TYPE:
                  case REACT_PORTAL_TYPE:
                    invokeCallback = true;
                }
            }
          }
          if (invokeCallback) {
            var _child = children;
            var mappedChild = callback(_child);
            var childKey = nameSoFar === "" ? SEPARATOR + getElementKey(_child, 0) : nameSoFar;
            if (isArray(mappedChild)) {
              var escapedChildKey = "";
              if (childKey != null) {
                escapedChildKey = escapeUserProvidedKey(childKey) + "/";
              }
              mapIntoArray(mappedChild, array2, escapedChildKey, "", function(c) {
                return c;
              });
            } else if (mappedChild != null) {
              if (isValidElement(mappedChild)) {
                {
                  if (mappedChild.key && (!_child || _child.key !== mappedChild.key)) {
                    checkKeyStringCoercion(mappedChild.key);
                  }
                }
                mappedChild = cloneAndReplaceKey(
                  mappedChild,
                  // Keep both the (mapped) and old keys if they differ, just as
                  // traverseAllChildren used to do for objects as children
                  escapedPrefix + // $FlowFixMe Flow incorrectly thinks React.Portal doesn't have a key
                  (mappedChild.key && (!_child || _child.key !== mappedChild.key) ? (
                    // $FlowFixMe Flow incorrectly thinks existing element's key can be a number
                    // eslint-disable-next-line react-internal/safe-string-coercion
                    escapeUserProvidedKey("" + mappedChild.key) + "/"
                  ) : "") + childKey
                );
              }
              array2.push(mappedChild);
            }
            return 1;
          }
          var child2;
          var nextName;
          var subtreeCount = 0;
          var nextNamePrefix = nameSoFar === "" ? SEPARATOR : nameSoFar + SUBSEPARATOR;
          if (isArray(children)) {
            for (var i = 0; i < children.length; i++) {
              child2 = children[i];
              nextName = nextNamePrefix + getElementKey(child2, i);
              subtreeCount += mapIntoArray(child2, array2, escapedPrefix, nextName, callback);
            }
          } else {
            var iteratorFn = getIteratorFn(children);
            if (typeof iteratorFn === "function") {
              var iterableChildren = children;
              {
                if (iteratorFn === iterableChildren.entries) {
                  if (!didWarnAboutMaps) {
                    warn("Using Maps as children is not supported. Use an array of keyed ReactElements instead.");
                  }
                  didWarnAboutMaps = true;
                }
              }
              var iterator = iteratorFn.call(iterableChildren);
              var step;
              var ii = 0;
              while (!(step = iterator.next()).done) {
                child2 = step.value;
                nextName = nextNamePrefix + getElementKey(child2, ii++);
                subtreeCount += mapIntoArray(child2, array2, escapedPrefix, nextName, callback);
              }
            } else if (type2 === "object") {
              var childrenString = String(children);
              throw new Error("Objects are not valid as a React child (found: " + (childrenString === "[object Object]" ? "object with keys {" + Object.keys(children).join(", ") + "}" : childrenString) + "). If you meant to render a collection of children, use an array instead.");
            }
          }
          return subtreeCount;
        }
        __name(mapIntoArray, "mapIntoArray");
        function mapChildren(children, func, context) {
          if (children == null) {
            return children;
          }
          var result = [];
          var count = 0;
          mapIntoArray(children, result, "", "", function(child2) {
            return func.call(context, child2, count++);
          });
          return result;
        }
        __name(mapChildren, "mapChildren");
        function countChildren(children) {
          var n = 0;
          mapChildren(children, function() {
            n++;
          });
          return n;
        }
        __name(countChildren, "countChildren");
        function forEachChildren(children, forEachFunc, forEachContext) {
          mapChildren(children, function() {
            forEachFunc.apply(this, arguments);
          }, forEachContext);
        }
        __name(forEachChildren, "forEachChildren");
        function toArray(children) {
          return mapChildren(children, function(child2) {
            return child2;
          }) || [];
        }
        __name(toArray, "toArray");
        function onlyChild(children) {
          if (!isValidElement(children)) {
            throw new Error("React.Children.only expected to receive a single React element child.");
          }
          return children;
        }
        __name(onlyChild, "onlyChild");
        function createContext(defaultValue) {
          var context = {
            $$typeof: REACT_CONTEXT_TYPE,
            // As a workaround to support multiple concurrent renderers, we categorize
            // some renderers as primary and others as secondary. We only expect
            // there to be two concurrent renderers at most: React Native (primary) and
            // Fabric (secondary); React DOM (primary) and React ART (secondary).
            // Secondary renderers store their context values on separate fields.
            _currentValue: defaultValue,
            _currentValue2: defaultValue,
            // Used to track how many concurrent renderers this context currently
            // supports within in a single renderer. Such as parallel server rendering.
            _threadCount: 0,
            // These are circular
            Provider: null,
            Consumer: null,
            // Add these to use same hidden class in VM as ServerContext
            _defaultValue: null,
            _globalName: null
          };
          context.Provider = {
            $$typeof: REACT_PROVIDER_TYPE,
            _context: context
          };
          var hasWarnedAboutUsingNestedContextConsumers = false;
          var hasWarnedAboutUsingConsumerProvider = false;
          var hasWarnedAboutDisplayNameOnConsumer = false;
          {
            var Consumer = {
              $$typeof: REACT_CONTEXT_TYPE,
              _context: context
            };
            Object.defineProperties(Consumer, {
              Provider: {
                get: /* @__PURE__ */ __name(function() {
                  if (!hasWarnedAboutUsingConsumerProvider) {
                    hasWarnedAboutUsingConsumerProvider = true;
                    error2("Rendering <Context.Consumer.Provider> is not supported and will be removed in a future major release. Did you mean to render <Context.Provider> instead?");
                  }
                  return context.Provider;
                }, "get"),
                set: /* @__PURE__ */ __name(function(_Provider) {
                  context.Provider = _Provider;
                }, "set")
              },
              _currentValue: {
                get: /* @__PURE__ */ __name(function() {
                  return context._currentValue;
                }, "get"),
                set: /* @__PURE__ */ __name(function(_currentValue) {
                  context._currentValue = _currentValue;
                }, "set")
              },
              _currentValue2: {
                get: /* @__PURE__ */ __name(function() {
                  return context._currentValue2;
                }, "get"),
                set: /* @__PURE__ */ __name(function(_currentValue2) {
                  context._currentValue2 = _currentValue2;
                }, "set")
              },
              _threadCount: {
                get: /* @__PURE__ */ __name(function() {
                  return context._threadCount;
                }, "get"),
                set: /* @__PURE__ */ __name(function(_threadCount) {
                  context._threadCount = _threadCount;
                }, "set")
              },
              Consumer: {
                get: /* @__PURE__ */ __name(function() {
                  if (!hasWarnedAboutUsingNestedContextConsumers) {
                    hasWarnedAboutUsingNestedContextConsumers = true;
                    error2("Rendering <Context.Consumer.Consumer> is not supported and will be removed in a future major release. Did you mean to render <Context.Consumer> instead?");
                  }
                  return context.Consumer;
                }, "get")
              },
              displayName: {
                get: /* @__PURE__ */ __name(function() {
                  return context.displayName;
                }, "get"),
                set: /* @__PURE__ */ __name(function(displayName) {
                  if (!hasWarnedAboutDisplayNameOnConsumer) {
                    warn("Setting `displayName` on Context.Consumer has no effect. You should set it directly on the context with Context.displayName = '%s'.", displayName);
                    hasWarnedAboutDisplayNameOnConsumer = true;
                  }
                }, "set")
              }
            });
            context.Consumer = Consumer;
          }
          {
            context._currentRenderer = null;
            context._currentRenderer2 = null;
          }
          return context;
        }
        __name(createContext, "createContext");
        var Uninitialized = -1;
        var Pending = 0;
        var Resolved = 1;
        var Rejected = 2;
        function lazyInitializer(payload) {
          if (payload._status === Uninitialized) {
            var ctor = payload._result;
            var thenable = ctor();
            thenable.then(function(moduleObject2) {
              if (payload._status === Pending || payload._status === Uninitialized) {
                var resolved = payload;
                resolved._status = Resolved;
                resolved._result = moduleObject2;
              }
            }, function(error3) {
              if (payload._status === Pending || payload._status === Uninitialized) {
                var rejected = payload;
                rejected._status = Rejected;
                rejected._result = error3;
              }
            });
            if (payload._status === Uninitialized) {
              var pending = payload;
              pending._status = Pending;
              pending._result = thenable;
            }
          }
          if (payload._status === Resolved) {
            var moduleObject = payload._result;
            {
              if (moduleObject === void 0) {
                error2("lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))\n\nDid you accidentally put curly braces around the import?", moduleObject);
              }
            }
            {
              if (!("default" in moduleObject)) {
                error2("lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))", moduleObject);
              }
            }
            return moduleObject.default;
          } else {
            throw payload._result;
          }
        }
        __name(lazyInitializer, "lazyInitializer");
        function lazy(ctor) {
          var payload = {
            // We use these fields to store the result.
            _status: Uninitialized,
            _result: ctor
          };
          var lazyType = {
            $$typeof: REACT_LAZY_TYPE,
            _payload: payload,
            _init: lazyInitializer
          };
          {
            var defaultProps;
            var propTypes;
            Object.defineProperties(lazyType, {
              defaultProps: {
                configurable: true,
                get: /* @__PURE__ */ __name(function() {
                  return defaultProps;
                }, "get"),
                set: /* @__PURE__ */ __name(function(newDefaultProps) {
                  error2("React.lazy(...): It is not supported to assign `defaultProps` to a lazy component import. Either specify them where the component is defined, or create a wrapping component around it.");
                  defaultProps = newDefaultProps;
                  Object.defineProperty(lazyType, "defaultProps", {
                    enumerable: true
                  });
                }, "set")
              },
              propTypes: {
                configurable: true,
                get: /* @__PURE__ */ __name(function() {
                  return propTypes;
                }, "get"),
                set: /* @__PURE__ */ __name(function(newPropTypes) {
                  error2("React.lazy(...): It is not supported to assign `propTypes` to a lazy component import. Either specify them where the component is defined, or create a wrapping component around it.");
                  propTypes = newPropTypes;
                  Object.defineProperty(lazyType, "propTypes", {
                    enumerable: true
                  });
                }, "set")
              }
            });
          }
          return lazyType;
        }
        __name(lazy, "lazy");
        function forwardRef(render3) {
          {
            if (render3 != null && render3.$$typeof === REACT_MEMO_TYPE) {
              error2("forwardRef requires a render function but received a `memo` component. Instead of forwardRef(memo(...)), use memo(forwardRef(...)).");
            } else if (typeof render3 !== "function") {
              error2("forwardRef requires a render function but was given %s.", render3 === null ? "null" : typeof render3);
            } else {
              if (render3.length !== 0 && render3.length !== 2) {
                error2("forwardRef render functions accept exactly two parameters: props and ref. %s", render3.length === 1 ? "Did you forget to use the ref parameter?" : "Any additional parameter will be undefined.");
              }
            }
            if (render3 != null) {
              if (render3.defaultProps != null || render3.propTypes != null) {
                error2("forwardRef render functions do not support propTypes or defaultProps. Did you accidentally pass a React component?");
              }
            }
          }
          var elementType = {
            $$typeof: REACT_FORWARD_REF_TYPE,
            render: render3
          };
          {
            var ownName;
            Object.defineProperty(elementType, "displayName", {
              enumerable: false,
              configurable: true,
              get: /* @__PURE__ */ __name(function() {
                return ownName;
              }, "get"),
              set: /* @__PURE__ */ __name(function(name) {
                ownName = name;
                if (!render3.name && !render3.displayName) {
                  render3.displayName = name;
                }
              }, "set")
            });
          }
          return elementType;
        }
        __name(forwardRef, "forwardRef");
        var REACT_MODULE_REFERENCE;
        {
          REACT_MODULE_REFERENCE = Symbol.for("react.module.reference");
        }
        function isValidElementType(type2) {
          if (typeof type2 === "string" || typeof type2 === "function") {
            return true;
          }
          if (type2 === REACT_FRAGMENT_TYPE || type2 === REACT_PROFILER_TYPE || enableDebugTracing || type2 === REACT_STRICT_MODE_TYPE || type2 === REACT_SUSPENSE_TYPE || type2 === REACT_SUSPENSE_LIST_TYPE || enableLegacyHidden || type2 === REACT_OFFSCREEN_TYPE || enableScopeAPI || enableCacheElement || enableTransitionTracing) {
            return true;
          }
          if (typeof type2 === "object" && type2 !== null) {
            if (type2.$$typeof === REACT_LAZY_TYPE || type2.$$typeof === REACT_MEMO_TYPE || type2.$$typeof === REACT_PROVIDER_TYPE || type2.$$typeof === REACT_CONTEXT_TYPE || type2.$$typeof === REACT_FORWARD_REF_TYPE || // This needs to include all possible module reference object
            // types supported by any Flight configuration anywhere since
            // we don't know which Flight build this will end up being used
            // with.
            type2.$$typeof === REACT_MODULE_REFERENCE || type2.getModuleId !== void 0) {
              return true;
            }
          }
          return false;
        }
        __name(isValidElementType, "isValidElementType");
        function memo(type2, compare) {
          {
            if (!isValidElementType(type2)) {
              error2("memo: The first argument must be a component. Instead received: %s", type2 === null ? "null" : typeof type2);
            }
          }
          var elementType = {
            $$typeof: REACT_MEMO_TYPE,
            type: type2,
            compare: compare === void 0 ? null : compare
          };
          {
            var ownName;
            Object.defineProperty(elementType, "displayName", {
              enumerable: false,
              configurable: true,
              get: /* @__PURE__ */ __name(function() {
                return ownName;
              }, "get"),
              set: /* @__PURE__ */ __name(function(name) {
                ownName = name;
                if (!type2.name && !type2.displayName) {
                  type2.displayName = name;
                }
              }, "set")
            });
          }
          return elementType;
        }
        __name(memo, "memo");
        function resolveDispatcher() {
          var dispatcher = ReactCurrentDispatcher.current;
          {
            if (dispatcher === null) {
              error2("Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:\n1. You might have mismatching versions of React and the renderer (such as React DOM)\n2. You might be breaking the Rules of Hooks\n3. You might have more than one copy of React in the same app\nSee https://reactjs.org/link/invalid-hook-call for tips about how to debug and fix this problem.");
            }
          }
          return dispatcher;
        }
        __name(resolveDispatcher, "resolveDispatcher");
        function useContext(Context) {
          var dispatcher = resolveDispatcher();
          {
            if (Context._context !== void 0) {
              var realContext = Context._context;
              if (realContext.Consumer === Context) {
                error2("Calling useContext(Context.Consumer) is not supported, may cause bugs, and will be removed in a future major release. Did you mean to call useContext(Context) instead?");
              } else if (realContext.Provider === Context) {
                error2("Calling useContext(Context.Provider) is not supported. Did you mean to call useContext(Context) instead?");
              }
            }
          }
          return dispatcher.useContext(Context);
        }
        __name(useContext, "useContext");
        function useState(initialState) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useState(initialState);
        }
        __name(useState, "useState");
        function useReducer(reducer, initialArg, init) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useReducer(reducer, initialArg, init);
        }
        __name(useReducer, "useReducer");
        function useRef(initialValue) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useRef(initialValue);
        }
        __name(useRef, "useRef");
        function useEffect(create2, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useEffect(create2, deps);
        }
        __name(useEffect, "useEffect");
        function useInsertionEffect(create2, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useInsertionEffect(create2, deps);
        }
        __name(useInsertionEffect, "useInsertionEffect");
        function useLayoutEffect(create2, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useLayoutEffect(create2, deps);
        }
        __name(useLayoutEffect, "useLayoutEffect");
        function useCallback(callback, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useCallback(callback, deps);
        }
        __name(useCallback, "useCallback");
        function useMemo(create2, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useMemo(create2, deps);
        }
        __name(useMemo, "useMemo");
        function useImperativeHandle(ref, create2, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useImperativeHandle(ref, create2, deps);
        }
        __name(useImperativeHandle, "useImperativeHandle");
        function useDebugValue(value, formatterFn) {
          {
            var dispatcher = resolveDispatcher();
            return dispatcher.useDebugValue(value, formatterFn);
          }
        }
        __name(useDebugValue, "useDebugValue");
        function useTransition() {
          var dispatcher = resolveDispatcher();
          return dispatcher.useTransition();
        }
        __name(useTransition, "useTransition");
        function useDeferredValue(value) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useDeferredValue(value);
        }
        __name(useDeferredValue, "useDeferredValue");
        function useId() {
          var dispatcher = resolveDispatcher();
          return dispatcher.useId();
        }
        __name(useId, "useId");
        function useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
        }
        __name(useSyncExternalStore, "useSyncExternalStore");
        var disabledDepth = 0;
        var prevLog;
        var prevInfo;
        var prevWarn;
        var prevError;
        var prevGroup;
        var prevGroupCollapsed;
        var prevGroupEnd;
        function disabledLog() {
        }
        __name(disabledLog, "disabledLog");
        disabledLog.__reactDisabledLog = true;
        function disableLogs() {
          {
            if (disabledDepth === 0) {
              prevLog = console.log;
              prevInfo = console.info;
              prevWarn = console.warn;
              prevError = console.error;
              prevGroup = console.group;
              prevGroupCollapsed = console.groupCollapsed;
              prevGroupEnd = console.groupEnd;
              var props = {
                configurable: true,
                enumerable: true,
                value: disabledLog,
                writable: true
              };
              Object.defineProperties(console, {
                info: props,
                log: props,
                warn: props,
                error: props,
                group: props,
                groupCollapsed: props,
                groupEnd: props
              });
            }
            disabledDepth++;
          }
        }
        __name(disableLogs, "disableLogs");
        function reenableLogs() {
          {
            disabledDepth--;
            if (disabledDepth === 0) {
              var props = {
                configurable: true,
                enumerable: true,
                writable: true
              };
              Object.defineProperties(console, {
                log: assign({}, props, {
                  value: prevLog
                }),
                info: assign({}, props, {
                  value: prevInfo
                }),
                warn: assign({}, props, {
                  value: prevWarn
                }),
                error: assign({}, props, {
                  value: prevError
                }),
                group: assign({}, props, {
                  value: prevGroup
                }),
                groupCollapsed: assign({}, props, {
                  value: prevGroupCollapsed
                }),
                groupEnd: assign({}, props, {
                  value: prevGroupEnd
                })
              });
            }
            if (disabledDepth < 0) {
              error2("disabledDepth fell below zero. This is a bug in React. Please file an issue.");
            }
          }
        }
        __name(reenableLogs, "reenableLogs");
        var ReactCurrentDispatcher$1 = ReactSharedInternals.ReactCurrentDispatcher;
        var prefix;
        function describeBuiltInComponentFrame(name, source, ownerFn) {
          {
            if (prefix === void 0) {
              try {
                throw Error();
              } catch (x) {
                var match2 = x.stack.trim().match(/\n( *(at )?)/);
                prefix = match2 && match2[1] || "";
              }
            }
            return "\n" + prefix + name;
          }
        }
        __name(describeBuiltInComponentFrame, "describeBuiltInComponentFrame");
        var reentry = false;
        var componentFrameCache;
        {
          var PossiblyWeakMap = typeof WeakMap === "function" ? WeakMap : Map;
          componentFrameCache = new PossiblyWeakMap();
        }
        function describeNativeComponentFrame(fn, construct) {
          if (!fn || reentry) {
            return "";
          }
          {
            var frame = componentFrameCache.get(fn);
            if (frame !== void 0) {
              return frame;
            }
          }
          var control;
          reentry = true;
          var previousPrepareStackTrace = Error.prepareStackTrace;
          Error.prepareStackTrace = void 0;
          var previousDispatcher;
          {
            previousDispatcher = ReactCurrentDispatcher$1.current;
            ReactCurrentDispatcher$1.current = null;
            disableLogs();
          }
          try {
            if (construct) {
              var Fake = /* @__PURE__ */ __name(function() {
                throw Error();
              }, "Fake");
              Object.defineProperty(Fake.prototype, "props", {
                set: /* @__PURE__ */ __name(function() {
                  throw Error();
                }, "set")
              });
              if (typeof Reflect === "object" && Reflect.construct) {
                try {
                  Reflect.construct(Fake, []);
                } catch (x) {
                  control = x;
                }
                Reflect.construct(fn, [], Fake);
              } else {
                try {
                  Fake.call();
                } catch (x) {
                  control = x;
                }
                fn.call(Fake.prototype);
              }
            } else {
              try {
                throw Error();
              } catch (x) {
                control = x;
              }
              fn();
            }
          } catch (sample) {
            if (sample && control && typeof sample.stack === "string") {
              var sampleLines = sample.stack.split("\n");
              var controlLines = control.stack.split("\n");
              var s2 = sampleLines.length - 1;
              var c = controlLines.length - 1;
              while (s2 >= 1 && c >= 0 && sampleLines[s2] !== controlLines[c]) {
                c--;
              }
              for (; s2 >= 1 && c >= 0; s2--, c--) {
                if (sampleLines[s2] !== controlLines[c]) {
                  if (s2 !== 1 || c !== 1) {
                    do {
                      s2--;
                      c--;
                      if (c < 0 || sampleLines[s2] !== controlLines[c]) {
                        var _frame = "\n" + sampleLines[s2].replace(" at new ", " at ");
                        if (fn.displayName && _frame.includes("<anonymous>")) {
                          _frame = _frame.replace("<anonymous>", fn.displayName);
                        }
                        {
                          if (typeof fn === "function") {
                            componentFrameCache.set(fn, _frame);
                          }
                        }
                        return _frame;
                      }
                    } while (s2 >= 1 && c >= 0);
                  }
                  break;
                }
              }
            }
          } finally {
            reentry = false;
            {
              ReactCurrentDispatcher$1.current = previousDispatcher;
              reenableLogs();
            }
            Error.prepareStackTrace = previousPrepareStackTrace;
          }
          var name = fn ? fn.displayName || fn.name : "";
          var syntheticFrame = name ? describeBuiltInComponentFrame(name) : "";
          {
            if (typeof fn === "function") {
              componentFrameCache.set(fn, syntheticFrame);
            }
          }
          return syntheticFrame;
        }
        __name(describeNativeComponentFrame, "describeNativeComponentFrame");
        function describeFunctionComponentFrame(fn, source, ownerFn) {
          {
            return describeNativeComponentFrame(fn, false);
          }
        }
        __name(describeFunctionComponentFrame, "describeFunctionComponentFrame");
        function shouldConstruct(Component2) {
          var prototype = Component2.prototype;
          return !!(prototype && prototype.isReactComponent);
        }
        __name(shouldConstruct, "shouldConstruct");
        function describeUnknownElementTypeFrameInDEV(type2, source, ownerFn) {
          if (type2 == null) {
            return "";
          }
          if (typeof type2 === "function") {
            {
              return describeNativeComponentFrame(type2, shouldConstruct(type2));
            }
          }
          if (typeof type2 === "string") {
            return describeBuiltInComponentFrame(type2);
          }
          switch (type2) {
            case REACT_SUSPENSE_TYPE:
              return describeBuiltInComponentFrame("Suspense");
            case REACT_SUSPENSE_LIST_TYPE:
              return describeBuiltInComponentFrame("SuspenseList");
          }
          if (typeof type2 === "object") {
            switch (type2.$$typeof) {
              case REACT_FORWARD_REF_TYPE:
                return describeFunctionComponentFrame(type2.render);
              case REACT_MEMO_TYPE:
                return describeUnknownElementTypeFrameInDEV(type2.type, source, ownerFn);
              case REACT_LAZY_TYPE: {
                var lazyComponent = type2;
                var payload = lazyComponent._payload;
                var init = lazyComponent._init;
                try {
                  return describeUnknownElementTypeFrameInDEV(init(payload), source, ownerFn);
                } catch (x) {
                }
              }
            }
          }
          return "";
        }
        __name(describeUnknownElementTypeFrameInDEV, "describeUnknownElementTypeFrameInDEV");
        var loggedTypeFailures = {};
        var ReactDebugCurrentFrame$1 = ReactSharedInternals.ReactDebugCurrentFrame;
        function setCurrentlyValidatingElement(element) {
          {
            if (element) {
              var owner = element._owner;
              var stack = describeUnknownElementTypeFrameInDEV(element.type, element._source, owner ? owner.type : null);
              ReactDebugCurrentFrame$1.setExtraStackFrame(stack);
            } else {
              ReactDebugCurrentFrame$1.setExtraStackFrame(null);
            }
          }
        }
        __name(setCurrentlyValidatingElement, "setCurrentlyValidatingElement");
        function checkPropTypes(typeSpecs, values, location, componentName, element) {
          {
            var has = Function.call.bind(hasOwnProperty);
            for (var typeSpecName in typeSpecs) {
              if (has(typeSpecs, typeSpecName)) {
                var error$1 = void 0;
                try {
                  if (typeof typeSpecs[typeSpecName] !== "function") {
                    var err = Error((componentName || "React class") + ": " + location + " type `" + typeSpecName + "` is invalid; it must be a function, usually from the `prop-types` package, but received `" + typeof typeSpecs[typeSpecName] + "`.This often happens because of typos such as `PropTypes.function` instead of `PropTypes.func`.");
                    err.name = "Invariant Violation";
                    throw err;
                  }
                  error$1 = typeSpecs[typeSpecName](values, typeSpecName, componentName, location, null, "SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED");
                } catch (ex) {
                  error$1 = ex;
                }
                if (error$1 && !(error$1 instanceof Error)) {
                  setCurrentlyValidatingElement(element);
                  error2("%s: type specification of %s `%s` is invalid; the type checker function must return `null` or an `Error` but returned a %s. You may have forgotten to pass an argument to the type checker creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and shape all require an argument).", componentName || "React class", location, typeSpecName, typeof error$1);
                  setCurrentlyValidatingElement(null);
                }
                if (error$1 instanceof Error && !(error$1.message in loggedTypeFailures)) {
                  loggedTypeFailures[error$1.message] = true;
                  setCurrentlyValidatingElement(element);
                  error2("Failed %s type: %s", location, error$1.message);
                  setCurrentlyValidatingElement(null);
                }
              }
            }
          }
        }
        __name(checkPropTypes, "checkPropTypes");
        function setCurrentlyValidatingElement$1(element) {
          {
            if (element) {
              var owner = element._owner;
              var stack = describeUnknownElementTypeFrameInDEV(element.type, element._source, owner ? owner.type : null);
              setExtraStackFrame(stack);
            } else {
              setExtraStackFrame(null);
            }
          }
        }
        __name(setCurrentlyValidatingElement$1, "setCurrentlyValidatingElement$1");
        var propTypesMisspellWarningShown;
        {
          propTypesMisspellWarningShown = false;
        }
        function getDeclarationErrorAddendum() {
          if (ReactCurrentOwner.current) {
            var name = getComponentNameFromType(ReactCurrentOwner.current.type);
            if (name) {
              return "\n\nCheck the render method of `" + name + "`.";
            }
          }
          return "";
        }
        __name(getDeclarationErrorAddendum, "getDeclarationErrorAddendum");
        function getSourceInfoErrorAddendum(source) {
          if (source !== void 0) {
            var fileName = source.fileName.replace(/^.*[\\\/]/, "");
            var lineNumber = source.lineNumber;
            return "\n\nCheck your code at " + fileName + ":" + lineNumber + ".";
          }
          return "";
        }
        __name(getSourceInfoErrorAddendum, "getSourceInfoErrorAddendum");
        function getSourceInfoErrorAddendumForProps(elementProps) {
          if (elementProps !== null && elementProps !== void 0) {
            return getSourceInfoErrorAddendum(elementProps.__source);
          }
          return "";
        }
        __name(getSourceInfoErrorAddendumForProps, "getSourceInfoErrorAddendumForProps");
        var ownerHasKeyUseWarning = {};
        function getCurrentComponentErrorInfo(parentType) {
          var info = getDeclarationErrorAddendum();
          if (!info) {
            var parentName = typeof parentType === "string" ? parentType : parentType.displayName || parentType.name;
            if (parentName) {
              info = "\n\nCheck the top-level render call using <" + parentName + ">.";
            }
          }
          return info;
        }
        __name(getCurrentComponentErrorInfo, "getCurrentComponentErrorInfo");
        function validateExplicitKey(element, parentType) {
          if (!element._store || element._store.validated || element.key != null) {
            return;
          }
          element._store.validated = true;
          var currentComponentErrorInfo = getCurrentComponentErrorInfo(parentType);
          if (ownerHasKeyUseWarning[currentComponentErrorInfo]) {
            return;
          }
          ownerHasKeyUseWarning[currentComponentErrorInfo] = true;
          var childOwner = "";
          if (element && element._owner && element._owner !== ReactCurrentOwner.current) {
            childOwner = " It was passed a child from " + getComponentNameFromType(element._owner.type) + ".";
          }
          {
            setCurrentlyValidatingElement$1(element);
            error2('Each child in a list should have a unique "key" prop.%s%s See https://reactjs.org/link/warning-keys for more information.', currentComponentErrorInfo, childOwner);
            setCurrentlyValidatingElement$1(null);
          }
        }
        __name(validateExplicitKey, "validateExplicitKey");
        function validateChildKeys(node2, parentType) {
          if (typeof node2 !== "object") {
            return;
          }
          if (isArray(node2)) {
            for (var i = 0; i < node2.length; i++) {
              var child2 = node2[i];
              if (isValidElement(child2)) {
                validateExplicitKey(child2, parentType);
              }
            }
          } else if (isValidElement(node2)) {
            if (node2._store) {
              node2._store.validated = true;
            }
          } else if (node2) {
            var iteratorFn = getIteratorFn(node2);
            if (typeof iteratorFn === "function") {
              if (iteratorFn !== node2.entries) {
                var iterator = iteratorFn.call(node2);
                var step;
                while (!(step = iterator.next()).done) {
                  if (isValidElement(step.value)) {
                    validateExplicitKey(step.value, parentType);
                  }
                }
              }
            }
          }
        }
        __name(validateChildKeys, "validateChildKeys");
        function validatePropTypes(element) {
          {
            var type2 = element.type;
            if (type2 === null || type2 === void 0 || typeof type2 === "string") {
              return;
            }
            var propTypes;
            if (typeof type2 === "function") {
              propTypes = type2.propTypes;
            } else if (typeof type2 === "object" && (type2.$$typeof === REACT_FORWARD_REF_TYPE || // Note: Memo only checks outer props here.
            // Inner props are checked in the reconciler.
            type2.$$typeof === REACT_MEMO_TYPE)) {
              propTypes = type2.propTypes;
            } else {
              return;
            }
            if (propTypes) {
              var name = getComponentNameFromType(type2);
              checkPropTypes(propTypes, element.props, "prop", name, element);
            } else if (type2.PropTypes !== void 0 && !propTypesMisspellWarningShown) {
              propTypesMisspellWarningShown = true;
              var _name = getComponentNameFromType(type2);
              error2("Component %s declared `PropTypes` instead of `propTypes`. Did you misspell the property assignment?", _name || "Unknown");
            }
            if (typeof type2.getDefaultProps === "function" && !type2.getDefaultProps.isReactClassApproved) {
              error2("getDefaultProps is only used on classic React.createClass definitions. Use a static property named `defaultProps` instead.");
            }
          }
        }
        __name(validatePropTypes, "validatePropTypes");
        function validateFragmentProps(fragment) {
          {
            var keys = Object.keys(fragment.props);
            for (var i = 0; i < keys.length; i++) {
              var key = keys[i];
              if (key !== "children" && key !== "key") {
                setCurrentlyValidatingElement$1(fragment);
                error2("Invalid prop `%s` supplied to `React.Fragment`. React.Fragment can only have `key` and `children` props.", key);
                setCurrentlyValidatingElement$1(null);
                break;
              }
            }
            if (fragment.ref !== null) {
              setCurrentlyValidatingElement$1(fragment);
              error2("Invalid attribute `ref` supplied to `React.Fragment`.");
              setCurrentlyValidatingElement$1(null);
            }
          }
        }
        __name(validateFragmentProps, "validateFragmentProps");
        function createElementWithValidation(type2, props, children) {
          var validType = isValidElementType(type2);
          if (!validType) {
            var info = "";
            if (type2 === void 0 || typeof type2 === "object" && type2 !== null && Object.keys(type2).length === 0) {
              info += " You likely forgot to export your component from the file it's defined in, or you might have mixed up default and named imports.";
            }
            var sourceInfo = getSourceInfoErrorAddendumForProps(props);
            if (sourceInfo) {
              info += sourceInfo;
            } else {
              info += getDeclarationErrorAddendum();
            }
            var typeString;
            if (type2 === null) {
              typeString = "null";
            } else if (isArray(type2)) {
              typeString = "array";
            } else if (type2 !== void 0 && type2.$$typeof === REACT_ELEMENT_TYPE) {
              typeString = "<" + (getComponentNameFromType(type2.type) || "Unknown") + " />";
              info = " Did you accidentally export a JSX literal instead of a component?";
            } else {
              typeString = typeof type2;
            }
            {
              error2("React.createElement: type is invalid -- expected a string (for built-in components) or a class/function (for composite components) but got: %s.%s", typeString, info);
            }
          }
          var element = createElement2.apply(this, arguments);
          if (element == null) {
            return element;
          }
          if (validType) {
            for (var i = 2; i < arguments.length; i++) {
              validateChildKeys(arguments[i], type2);
            }
          }
          if (type2 === REACT_FRAGMENT_TYPE) {
            validateFragmentProps(element);
          } else {
            validatePropTypes(element);
          }
          return element;
        }
        __name(createElementWithValidation, "createElementWithValidation");
        var didWarnAboutDeprecatedCreateFactory = false;
        function createFactoryWithValidation(type2) {
          var validatedFactory = createElementWithValidation.bind(null, type2);
          validatedFactory.type = type2;
          {
            if (!didWarnAboutDeprecatedCreateFactory) {
              didWarnAboutDeprecatedCreateFactory = true;
              warn("React.createFactory() is deprecated and will be removed in a future major release. Consider using JSX or use React.createElement() directly instead.");
            }
            Object.defineProperty(validatedFactory, "type", {
              enumerable: false,
              get: /* @__PURE__ */ __name(function() {
                warn("Factory.type is deprecated. Access the class directly before passing it to createFactory.");
                Object.defineProperty(this, "type", {
                  value: type2
                });
                return type2;
              }, "get")
            });
          }
          return validatedFactory;
        }
        __name(createFactoryWithValidation, "createFactoryWithValidation");
        function cloneElementWithValidation(element, props, children) {
          var newElement = cloneElement.apply(this, arguments);
          for (var i = 2; i < arguments.length; i++) {
            validateChildKeys(arguments[i], newElement.type);
          }
          validatePropTypes(newElement);
          return newElement;
        }
        __name(cloneElementWithValidation, "cloneElementWithValidation");
        function startTransition(scope, options) {
          var prevTransition = ReactCurrentBatchConfig.transition;
          ReactCurrentBatchConfig.transition = {};
          var currentTransition = ReactCurrentBatchConfig.transition;
          {
            ReactCurrentBatchConfig.transition._updatedFibers = /* @__PURE__ */ new Set();
          }
          try {
            scope();
          } finally {
            ReactCurrentBatchConfig.transition = prevTransition;
            {
              if (prevTransition === null && currentTransition._updatedFibers) {
                var updatedFibersCount = currentTransition._updatedFibers.size;
                if (updatedFibersCount > 10) {
                  warn("Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table.");
                }
                currentTransition._updatedFibers.clear();
              }
            }
          }
        }
        __name(startTransition, "startTransition");
        var didWarnAboutMessageChannel = false;
        var enqueueTaskImpl = null;
        function enqueueTask(task) {
          if (enqueueTaskImpl === null) {
            try {
              var requireString = ("require" + Math.random()).slice(0, 7);
              var nodeRequire = module && module[requireString];
              enqueueTaskImpl = nodeRequire.call(module, "timers").setImmediate;
            } catch (_err) {
              enqueueTaskImpl = /* @__PURE__ */ __name(function(callback) {
                {
                  if (didWarnAboutMessageChannel === false) {
                    didWarnAboutMessageChannel = true;
                    if (typeof MessageChannel === "undefined") {
                      error2("This browser does not have a MessageChannel implementation, so enqueuing tasks via await act(async () => ...) will fail. Please file an issue at https://github.com/facebook/react/issues if you encounter this warning.");
                    }
                  }
                }
                var channel = new MessageChannel();
                channel.port1.onmessage = callback;
                channel.port2.postMessage(void 0);
              }, "enqueueTaskImpl");
            }
          }
          return enqueueTaskImpl(task);
        }
        __name(enqueueTask, "enqueueTask");
        var actScopeDepth = 0;
        var didWarnNoAwaitAct = false;
        function act(callback) {
          {
            var prevActScopeDepth = actScopeDepth;
            actScopeDepth++;
            if (ReactCurrentActQueue.current === null) {
              ReactCurrentActQueue.current = [];
            }
            var prevIsBatchingLegacy = ReactCurrentActQueue.isBatchingLegacy;
            var result;
            try {
              ReactCurrentActQueue.isBatchingLegacy = true;
              result = callback();
              if (!prevIsBatchingLegacy && ReactCurrentActQueue.didScheduleLegacyUpdate) {
                var queue = ReactCurrentActQueue.current;
                if (queue !== null) {
                  ReactCurrentActQueue.didScheduleLegacyUpdate = false;
                  flushActQueue(queue);
                }
              }
            } catch (error3) {
              popActScope(prevActScopeDepth);
              throw error3;
            } finally {
              ReactCurrentActQueue.isBatchingLegacy = prevIsBatchingLegacy;
            }
            if (result !== null && typeof result === "object" && typeof result.then === "function") {
              var thenableResult = result;
              var wasAwaited = false;
              var thenable = {
                then: /* @__PURE__ */ __name(function(resolve3, reject) {
                  wasAwaited = true;
                  thenableResult.then(function(returnValue2) {
                    popActScope(prevActScopeDepth);
                    if (actScopeDepth === 0) {
                      recursivelyFlushAsyncActWork(returnValue2, resolve3, reject);
                    } else {
                      resolve3(returnValue2);
                    }
                  }, function(error3) {
                    popActScope(prevActScopeDepth);
                    reject(error3);
                  });
                }, "then")
              };
              {
                if (!didWarnNoAwaitAct && typeof Promise !== "undefined") {
                  Promise.resolve().then(function() {
                  }).then(function() {
                    if (!wasAwaited) {
                      didWarnNoAwaitAct = true;
                      error2("You called act(async () => ...) without await. This could lead to unexpected testing behaviour, interleaving multiple act calls and mixing their scopes. You should - await act(async () => ...);");
                    }
                  });
                }
              }
              return thenable;
            } else {
              var returnValue = result;
              popActScope(prevActScopeDepth);
              if (actScopeDepth === 0) {
                var _queue = ReactCurrentActQueue.current;
                if (_queue !== null) {
                  flushActQueue(_queue);
                  ReactCurrentActQueue.current = null;
                }
                var _thenable = {
                  then: /* @__PURE__ */ __name(function(resolve3, reject) {
                    if (ReactCurrentActQueue.current === null) {
                      ReactCurrentActQueue.current = [];
                      recursivelyFlushAsyncActWork(returnValue, resolve3, reject);
                    } else {
                      resolve3(returnValue);
                    }
                  }, "then")
                };
                return _thenable;
              } else {
                var _thenable2 = {
                  then: /* @__PURE__ */ __name(function(resolve3, reject) {
                    resolve3(returnValue);
                  }, "then")
                };
                return _thenable2;
              }
            }
          }
        }
        __name(act, "act");
        function popActScope(prevActScopeDepth) {
          {
            if (prevActScopeDepth !== actScopeDepth - 1) {
              error2("You seem to have overlapping act() calls, this is not supported. Be sure to await previous act() calls before making a new one. ");
            }
            actScopeDepth = prevActScopeDepth;
          }
        }
        __name(popActScope, "popActScope");
        function recursivelyFlushAsyncActWork(returnValue, resolve3, reject) {
          {
            var queue = ReactCurrentActQueue.current;
            if (queue !== null) {
              try {
                flushActQueue(queue);
                enqueueTask(function() {
                  if (queue.length === 0) {
                    ReactCurrentActQueue.current = null;
                    resolve3(returnValue);
                  } else {
                    recursivelyFlushAsyncActWork(returnValue, resolve3, reject);
                  }
                });
              } catch (error3) {
                reject(error3);
              }
            } else {
              resolve3(returnValue);
            }
          }
        }
        __name(recursivelyFlushAsyncActWork, "recursivelyFlushAsyncActWork");
        var isFlushing = false;
        function flushActQueue(queue) {
          {
            if (!isFlushing) {
              isFlushing = true;
              var i = 0;
              try {
                for (; i < queue.length; i++) {
                  var callback = queue[i];
                  do {
                    callback = callback(true);
                  } while (callback !== null);
                }
                queue.length = 0;
              } catch (error3) {
                queue = queue.slice(i + 1);
                throw error3;
              } finally {
                isFlushing = false;
              }
            }
          }
        }
        __name(flushActQueue, "flushActQueue");
        var createElement$1 = createElementWithValidation;
        var cloneElement$1 = cloneElementWithValidation;
        var createFactory = createFactoryWithValidation;
        var Children = {
          map: mapChildren,
          forEach: forEachChildren,
          count: countChildren,
          toArray,
          only: onlyChild
        };
        exports.Children = Children;
        exports.Component = Component;
        exports.Fragment = REACT_FRAGMENT_TYPE;
        exports.Profiler = REACT_PROFILER_TYPE;
        exports.PureComponent = PureComponent;
        exports.StrictMode = REACT_STRICT_MODE_TYPE;
        exports.Suspense = REACT_SUSPENSE_TYPE;
        exports.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = ReactSharedInternals;
        exports.act = act;
        exports.cloneElement = cloneElement$1;
        exports.createContext = createContext;
        exports.createElement = createElement$1;
        exports.createFactory = createFactory;
        exports.createRef = createRef;
        exports.forwardRef = forwardRef;
        exports.isValidElement = isValidElement;
        exports.lazy = lazy;
        exports.memo = memo;
        exports.startTransition = startTransition;
        exports.unstable_act = act;
        exports.useCallback = useCallback;
        exports.useContext = useContext;
        exports.useDebugValue = useDebugValue;
        exports.useDeferredValue = useDeferredValue;
        exports.useEffect = useEffect;
        exports.useId = useId;
        exports.useImperativeHandle = useImperativeHandle;
        exports.useInsertionEffect = useInsertionEffect;
        exports.useLayoutEffect = useLayoutEffect;
        exports.useMemo = useMemo;
        exports.useReducer = useReducer;
        exports.useRef = useRef;
        exports.useState = useState;
        exports.useSyncExternalStore = useSyncExternalStore;
        exports.useTransition = useTransition;
        exports.version = ReactVersion;
        if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop === "function") {
          __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(new Error());
        }
      })();
    }
  }
});

// ../node_modules/react/index.js
var require_react = __commonJS({
  "../node_modules/react/index.js"(exports, module) {
    "use strict";
    init_functionsRoutes_0_8824942990098752();
    if (false) {
      module.exports = null;
    } else {
      module.exports = require_react_development();
    }
  }
});

// ../node_modules/react/cjs/react-jsx-runtime.development.js
var require_react_jsx_runtime_development = __commonJS({
  "../node_modules/react/cjs/react-jsx-runtime.development.js"(exports) {
    "use strict";
    init_functionsRoutes_0_8824942990098752();
    if (true) {
      (function() {
        "use strict";
        var React = require_react();
        var REACT_ELEMENT_TYPE = Symbol.for("react.element");
        var REACT_PORTAL_TYPE = Symbol.for("react.portal");
        var REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
        var REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode");
        var REACT_PROFILER_TYPE = Symbol.for("react.profiler");
        var REACT_PROVIDER_TYPE = Symbol.for("react.provider");
        var REACT_CONTEXT_TYPE = Symbol.for("react.context");
        var REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref");
        var REACT_SUSPENSE_TYPE = Symbol.for("react.suspense");
        var REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list");
        var REACT_MEMO_TYPE = Symbol.for("react.memo");
        var REACT_LAZY_TYPE = Symbol.for("react.lazy");
        var REACT_OFFSCREEN_TYPE = Symbol.for("react.offscreen");
        var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
        var FAUX_ITERATOR_SYMBOL = "@@iterator";
        function getIteratorFn(maybeIterable) {
          if (maybeIterable === null || typeof maybeIterable !== "object") {
            return null;
          }
          var maybeIterator = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL];
          if (typeof maybeIterator === "function") {
            return maybeIterator;
          }
          return null;
        }
        __name(getIteratorFn, "getIteratorFn");
        var ReactSharedInternals = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
        function error2(format2) {
          {
            {
              for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
                args[_key2 - 1] = arguments[_key2];
              }
              printWarning("error", format2, args);
            }
          }
        }
        __name(error2, "error");
        function printWarning(level, format2, args) {
          {
            var ReactDebugCurrentFrame2 = ReactSharedInternals.ReactDebugCurrentFrame;
            var stack = ReactDebugCurrentFrame2.getStackAddendum();
            if (stack !== "") {
              format2 += "%s";
              args = args.concat([stack]);
            }
            var argsWithFormat = args.map(function(item2) {
              return String(item2);
            });
            argsWithFormat.unshift("Warning: " + format2);
            Function.prototype.apply.call(console[level], console, argsWithFormat);
          }
        }
        __name(printWarning, "printWarning");
        var enableScopeAPI = false;
        var enableCacheElement = false;
        var enableTransitionTracing = false;
        var enableLegacyHidden = false;
        var enableDebugTracing = false;
        var REACT_MODULE_REFERENCE;
        {
          REACT_MODULE_REFERENCE = Symbol.for("react.module.reference");
        }
        function isValidElementType(type2) {
          if (typeof type2 === "string" || typeof type2 === "function") {
            return true;
          }
          if (type2 === REACT_FRAGMENT_TYPE || type2 === REACT_PROFILER_TYPE || enableDebugTracing || type2 === REACT_STRICT_MODE_TYPE || type2 === REACT_SUSPENSE_TYPE || type2 === REACT_SUSPENSE_LIST_TYPE || enableLegacyHidden || type2 === REACT_OFFSCREEN_TYPE || enableScopeAPI || enableCacheElement || enableTransitionTracing) {
            return true;
          }
          if (typeof type2 === "object" && type2 !== null) {
            if (type2.$$typeof === REACT_LAZY_TYPE || type2.$$typeof === REACT_MEMO_TYPE || type2.$$typeof === REACT_PROVIDER_TYPE || type2.$$typeof === REACT_CONTEXT_TYPE || type2.$$typeof === REACT_FORWARD_REF_TYPE || // This needs to include all possible module reference object
            // types supported by any Flight configuration anywhere since
            // we don't know which Flight build this will end up being used
            // with.
            type2.$$typeof === REACT_MODULE_REFERENCE || type2.getModuleId !== void 0) {
              return true;
            }
          }
          return false;
        }
        __name(isValidElementType, "isValidElementType");
        function getWrappedName(outerType, innerType, wrapperName) {
          var displayName = outerType.displayName;
          if (displayName) {
            return displayName;
          }
          var functionName = innerType.displayName || innerType.name || "";
          return functionName !== "" ? wrapperName + "(" + functionName + ")" : wrapperName;
        }
        __name(getWrappedName, "getWrappedName");
        function getContextName(type2) {
          return type2.displayName || "Context";
        }
        __name(getContextName, "getContextName");
        function getComponentNameFromType(type2) {
          if (type2 == null) {
            return null;
          }
          {
            if (typeof type2.tag === "number") {
              error2("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue.");
            }
          }
          if (typeof type2 === "function") {
            return type2.displayName || type2.name || null;
          }
          if (typeof type2 === "string") {
            return type2;
          }
          switch (type2) {
            case REACT_FRAGMENT_TYPE:
              return "Fragment";
            case REACT_PORTAL_TYPE:
              return "Portal";
            case REACT_PROFILER_TYPE:
              return "Profiler";
            case REACT_STRICT_MODE_TYPE:
              return "StrictMode";
            case REACT_SUSPENSE_TYPE:
              return "Suspense";
            case REACT_SUSPENSE_LIST_TYPE:
              return "SuspenseList";
          }
          if (typeof type2 === "object") {
            switch (type2.$$typeof) {
              case REACT_CONTEXT_TYPE:
                var context = type2;
                return getContextName(context) + ".Consumer";
              case REACT_PROVIDER_TYPE:
                var provider = type2;
                return getContextName(provider._context) + ".Provider";
              case REACT_FORWARD_REF_TYPE:
                return getWrappedName(type2, type2.render, "ForwardRef");
              case REACT_MEMO_TYPE:
                var outerName = type2.displayName || null;
                if (outerName !== null) {
                  return outerName;
                }
                return getComponentNameFromType(type2.type) || "Memo";
              case REACT_LAZY_TYPE: {
                var lazyComponent = type2;
                var payload = lazyComponent._payload;
                var init = lazyComponent._init;
                try {
                  return getComponentNameFromType(init(payload));
                } catch (x) {
                  return null;
                }
              }
            }
          }
          return null;
        }
        __name(getComponentNameFromType, "getComponentNameFromType");
        var assign = Object.assign;
        var disabledDepth = 0;
        var prevLog;
        var prevInfo;
        var prevWarn;
        var prevError;
        var prevGroup;
        var prevGroupCollapsed;
        var prevGroupEnd;
        function disabledLog() {
        }
        __name(disabledLog, "disabledLog");
        disabledLog.__reactDisabledLog = true;
        function disableLogs() {
          {
            if (disabledDepth === 0) {
              prevLog = console.log;
              prevInfo = console.info;
              prevWarn = console.warn;
              prevError = console.error;
              prevGroup = console.group;
              prevGroupCollapsed = console.groupCollapsed;
              prevGroupEnd = console.groupEnd;
              var props = {
                configurable: true,
                enumerable: true,
                value: disabledLog,
                writable: true
              };
              Object.defineProperties(console, {
                info: props,
                log: props,
                warn: props,
                error: props,
                group: props,
                groupCollapsed: props,
                groupEnd: props
              });
            }
            disabledDepth++;
          }
        }
        __name(disableLogs, "disableLogs");
        function reenableLogs() {
          {
            disabledDepth--;
            if (disabledDepth === 0) {
              var props = {
                configurable: true,
                enumerable: true,
                writable: true
              };
              Object.defineProperties(console, {
                log: assign({}, props, {
                  value: prevLog
                }),
                info: assign({}, props, {
                  value: prevInfo
                }),
                warn: assign({}, props, {
                  value: prevWarn
                }),
                error: assign({}, props, {
                  value: prevError
                }),
                group: assign({}, props, {
                  value: prevGroup
                }),
                groupCollapsed: assign({}, props, {
                  value: prevGroupCollapsed
                }),
                groupEnd: assign({}, props, {
                  value: prevGroupEnd
                })
              });
            }
            if (disabledDepth < 0) {
              error2("disabledDepth fell below zero. This is a bug in React. Please file an issue.");
            }
          }
        }
        __name(reenableLogs, "reenableLogs");
        var ReactCurrentDispatcher = ReactSharedInternals.ReactCurrentDispatcher;
        var prefix;
        function describeBuiltInComponentFrame(name, source, ownerFn) {
          {
            if (prefix === void 0) {
              try {
                throw Error();
              } catch (x) {
                var match2 = x.stack.trim().match(/\n( *(at )?)/);
                prefix = match2 && match2[1] || "";
              }
            }
            return "\n" + prefix + name;
          }
        }
        __name(describeBuiltInComponentFrame, "describeBuiltInComponentFrame");
        var reentry = false;
        var componentFrameCache;
        {
          var PossiblyWeakMap = typeof WeakMap === "function" ? WeakMap : Map;
          componentFrameCache = new PossiblyWeakMap();
        }
        function describeNativeComponentFrame(fn, construct) {
          if (!fn || reentry) {
            return "";
          }
          {
            var frame = componentFrameCache.get(fn);
            if (frame !== void 0) {
              return frame;
            }
          }
          var control;
          reentry = true;
          var previousPrepareStackTrace = Error.prepareStackTrace;
          Error.prepareStackTrace = void 0;
          var previousDispatcher;
          {
            previousDispatcher = ReactCurrentDispatcher.current;
            ReactCurrentDispatcher.current = null;
            disableLogs();
          }
          try {
            if (construct) {
              var Fake = /* @__PURE__ */ __name(function() {
                throw Error();
              }, "Fake");
              Object.defineProperty(Fake.prototype, "props", {
                set: /* @__PURE__ */ __name(function() {
                  throw Error();
                }, "set")
              });
              if (typeof Reflect === "object" && Reflect.construct) {
                try {
                  Reflect.construct(Fake, []);
                } catch (x) {
                  control = x;
                }
                Reflect.construct(fn, [], Fake);
              } else {
                try {
                  Fake.call();
                } catch (x) {
                  control = x;
                }
                fn.call(Fake.prototype);
              }
            } else {
              try {
                throw Error();
              } catch (x) {
                control = x;
              }
              fn();
            }
          } catch (sample) {
            if (sample && control && typeof sample.stack === "string") {
              var sampleLines = sample.stack.split("\n");
              var controlLines = control.stack.split("\n");
              var s2 = sampleLines.length - 1;
              var c = controlLines.length - 1;
              while (s2 >= 1 && c >= 0 && sampleLines[s2] !== controlLines[c]) {
                c--;
              }
              for (; s2 >= 1 && c >= 0; s2--, c--) {
                if (sampleLines[s2] !== controlLines[c]) {
                  if (s2 !== 1 || c !== 1) {
                    do {
                      s2--;
                      c--;
                      if (c < 0 || sampleLines[s2] !== controlLines[c]) {
                        var _frame = "\n" + sampleLines[s2].replace(" at new ", " at ");
                        if (fn.displayName && _frame.includes("<anonymous>")) {
                          _frame = _frame.replace("<anonymous>", fn.displayName);
                        }
                        {
                          if (typeof fn === "function") {
                            componentFrameCache.set(fn, _frame);
                          }
                        }
                        return _frame;
                      }
                    } while (s2 >= 1 && c >= 0);
                  }
                  break;
                }
              }
            }
          } finally {
            reentry = false;
            {
              ReactCurrentDispatcher.current = previousDispatcher;
              reenableLogs();
            }
            Error.prepareStackTrace = previousPrepareStackTrace;
          }
          var name = fn ? fn.displayName || fn.name : "";
          var syntheticFrame = name ? describeBuiltInComponentFrame(name) : "";
          {
            if (typeof fn === "function") {
              componentFrameCache.set(fn, syntheticFrame);
            }
          }
          return syntheticFrame;
        }
        __name(describeNativeComponentFrame, "describeNativeComponentFrame");
        function describeFunctionComponentFrame(fn, source, ownerFn) {
          {
            return describeNativeComponentFrame(fn, false);
          }
        }
        __name(describeFunctionComponentFrame, "describeFunctionComponentFrame");
        function shouldConstruct(Component) {
          var prototype = Component.prototype;
          return !!(prototype && prototype.isReactComponent);
        }
        __name(shouldConstruct, "shouldConstruct");
        function describeUnknownElementTypeFrameInDEV(type2, source, ownerFn) {
          if (type2 == null) {
            return "";
          }
          if (typeof type2 === "function") {
            {
              return describeNativeComponentFrame(type2, shouldConstruct(type2));
            }
          }
          if (typeof type2 === "string") {
            return describeBuiltInComponentFrame(type2);
          }
          switch (type2) {
            case REACT_SUSPENSE_TYPE:
              return describeBuiltInComponentFrame("Suspense");
            case REACT_SUSPENSE_LIST_TYPE:
              return describeBuiltInComponentFrame("SuspenseList");
          }
          if (typeof type2 === "object") {
            switch (type2.$$typeof) {
              case REACT_FORWARD_REF_TYPE:
                return describeFunctionComponentFrame(type2.render);
              case REACT_MEMO_TYPE:
                return describeUnknownElementTypeFrameInDEV(type2.type, source, ownerFn);
              case REACT_LAZY_TYPE: {
                var lazyComponent = type2;
                var payload = lazyComponent._payload;
                var init = lazyComponent._init;
                try {
                  return describeUnknownElementTypeFrameInDEV(init(payload), source, ownerFn);
                } catch (x) {
                }
              }
            }
          }
          return "";
        }
        __name(describeUnknownElementTypeFrameInDEV, "describeUnknownElementTypeFrameInDEV");
        var hasOwnProperty = Object.prototype.hasOwnProperty;
        var loggedTypeFailures = {};
        var ReactDebugCurrentFrame = ReactSharedInternals.ReactDebugCurrentFrame;
        function setCurrentlyValidatingElement(element) {
          {
            if (element) {
              var owner = element._owner;
              var stack = describeUnknownElementTypeFrameInDEV(element.type, element._source, owner ? owner.type : null);
              ReactDebugCurrentFrame.setExtraStackFrame(stack);
            } else {
              ReactDebugCurrentFrame.setExtraStackFrame(null);
            }
          }
        }
        __name(setCurrentlyValidatingElement, "setCurrentlyValidatingElement");
        function checkPropTypes(typeSpecs, values, location, componentName, element) {
          {
            var has = Function.call.bind(hasOwnProperty);
            for (var typeSpecName in typeSpecs) {
              if (has(typeSpecs, typeSpecName)) {
                var error$1 = void 0;
                try {
                  if (typeof typeSpecs[typeSpecName] !== "function") {
                    var err = Error((componentName || "React class") + ": " + location + " type `" + typeSpecName + "` is invalid; it must be a function, usually from the `prop-types` package, but received `" + typeof typeSpecs[typeSpecName] + "`.This often happens because of typos such as `PropTypes.function` instead of `PropTypes.func`.");
                    err.name = "Invariant Violation";
                    throw err;
                  }
                  error$1 = typeSpecs[typeSpecName](values, typeSpecName, componentName, location, null, "SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED");
                } catch (ex) {
                  error$1 = ex;
                }
                if (error$1 && !(error$1 instanceof Error)) {
                  setCurrentlyValidatingElement(element);
                  error2("%s: type specification of %s `%s` is invalid; the type checker function must return `null` or an `Error` but returned a %s. You may have forgotten to pass an argument to the type checker creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and shape all require an argument).", componentName || "React class", location, typeSpecName, typeof error$1);
                  setCurrentlyValidatingElement(null);
                }
                if (error$1 instanceof Error && !(error$1.message in loggedTypeFailures)) {
                  loggedTypeFailures[error$1.message] = true;
                  setCurrentlyValidatingElement(element);
                  error2("Failed %s type: %s", location, error$1.message);
                  setCurrentlyValidatingElement(null);
                }
              }
            }
          }
        }
        __name(checkPropTypes, "checkPropTypes");
        var isArrayImpl = Array.isArray;
        function isArray(a) {
          return isArrayImpl(a);
        }
        __name(isArray, "isArray");
        function typeName(value) {
          {
            var hasToStringTag = typeof Symbol === "function" && Symbol.toStringTag;
            var type2 = hasToStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
            return type2;
          }
        }
        __name(typeName, "typeName");
        function willCoercionThrow(value) {
          {
            try {
              testStringCoercion(value);
              return false;
            } catch (e) {
              return true;
            }
          }
        }
        __name(willCoercionThrow, "willCoercionThrow");
        function testStringCoercion(value) {
          return "" + value;
        }
        __name(testStringCoercion, "testStringCoercion");
        function checkKeyStringCoercion(value) {
          {
            if (willCoercionThrow(value)) {
              error2("The provided key is an unsupported type %s. This value must be coerced to a string before before using it here.", typeName(value));
              return testStringCoercion(value);
            }
          }
        }
        __name(checkKeyStringCoercion, "checkKeyStringCoercion");
        var ReactCurrentOwner = ReactSharedInternals.ReactCurrentOwner;
        var RESERVED_PROPS = {
          key: true,
          ref: true,
          __self: true,
          __source: true
        };
        var specialPropKeyWarningShown;
        var specialPropRefWarningShown;
        var didWarnAboutStringRefs;
        {
          didWarnAboutStringRefs = {};
        }
        function hasValidRef(config2) {
          {
            if (hasOwnProperty.call(config2, "ref")) {
              var getter = Object.getOwnPropertyDescriptor(config2, "ref").get;
              if (getter && getter.isReactWarning) {
                return false;
              }
            }
          }
          return config2.ref !== void 0;
        }
        __name(hasValidRef, "hasValidRef");
        function hasValidKey(config2) {
          {
            if (hasOwnProperty.call(config2, "key")) {
              var getter = Object.getOwnPropertyDescriptor(config2, "key").get;
              if (getter && getter.isReactWarning) {
                return false;
              }
            }
          }
          return config2.key !== void 0;
        }
        __name(hasValidKey, "hasValidKey");
        function warnIfStringRefCannotBeAutoConverted(config2, self) {
          {
            if (typeof config2.ref === "string" && ReactCurrentOwner.current && self && ReactCurrentOwner.current.stateNode !== self) {
              var componentName = getComponentNameFromType(ReactCurrentOwner.current.type);
              if (!didWarnAboutStringRefs[componentName]) {
                error2('Component "%s" contains the string ref "%s". Support for string refs will be removed in a future major release. This case cannot be automatically converted to an arrow function. We ask you to manually fix this case by using useRef() or createRef() instead. Learn more about using refs safely here: https://reactjs.org/link/strict-mode-string-ref', getComponentNameFromType(ReactCurrentOwner.current.type), config2.ref);
                didWarnAboutStringRefs[componentName] = true;
              }
            }
          }
        }
        __name(warnIfStringRefCannotBeAutoConverted, "warnIfStringRefCannotBeAutoConverted");
        function defineKeyPropWarningGetter(props, displayName) {
          {
            var warnAboutAccessingKey = /* @__PURE__ */ __name(function() {
              if (!specialPropKeyWarningShown) {
                specialPropKeyWarningShown = true;
                error2("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", displayName);
              }
            }, "warnAboutAccessingKey");
            warnAboutAccessingKey.isReactWarning = true;
            Object.defineProperty(props, "key", {
              get: warnAboutAccessingKey,
              configurable: true
            });
          }
        }
        __name(defineKeyPropWarningGetter, "defineKeyPropWarningGetter");
        function defineRefPropWarningGetter(props, displayName) {
          {
            var warnAboutAccessingRef = /* @__PURE__ */ __name(function() {
              if (!specialPropRefWarningShown) {
                specialPropRefWarningShown = true;
                error2("%s: `ref` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", displayName);
              }
            }, "warnAboutAccessingRef");
            warnAboutAccessingRef.isReactWarning = true;
            Object.defineProperty(props, "ref", {
              get: warnAboutAccessingRef,
              configurable: true
            });
          }
        }
        __name(defineRefPropWarningGetter, "defineRefPropWarningGetter");
        var ReactElement = /* @__PURE__ */ __name(function(type2, key, ref, self, source, owner, props) {
          var element = {
            // This tag allows us to uniquely identify this as a React Element
            $$typeof: REACT_ELEMENT_TYPE,
            // Built-in properties that belong on the element
            type: type2,
            key,
            ref,
            props,
            // Record the component responsible for creating this element.
            _owner: owner
          };
          {
            element._store = {};
            Object.defineProperty(element._store, "validated", {
              configurable: false,
              enumerable: false,
              writable: true,
              value: false
            });
            Object.defineProperty(element, "_self", {
              configurable: false,
              enumerable: false,
              writable: false,
              value: self
            });
            Object.defineProperty(element, "_source", {
              configurable: false,
              enumerable: false,
              writable: false,
              value: source
            });
            if (Object.freeze) {
              Object.freeze(element.props);
              Object.freeze(element);
            }
          }
          return element;
        }, "ReactElement");
        function jsxDEV(type2, config2, maybeKey, source, self) {
          {
            var propName;
            var props = {};
            var key = null;
            var ref = null;
            if (maybeKey !== void 0) {
              {
                checkKeyStringCoercion(maybeKey);
              }
              key = "" + maybeKey;
            }
            if (hasValidKey(config2)) {
              {
                checkKeyStringCoercion(config2.key);
              }
              key = "" + config2.key;
            }
            if (hasValidRef(config2)) {
              ref = config2.ref;
              warnIfStringRefCannotBeAutoConverted(config2, self);
            }
            for (propName in config2) {
              if (hasOwnProperty.call(config2, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
                props[propName] = config2[propName];
              }
            }
            if (type2 && type2.defaultProps) {
              var defaultProps = type2.defaultProps;
              for (propName in defaultProps) {
                if (props[propName] === void 0) {
                  props[propName] = defaultProps[propName];
                }
              }
            }
            if (key || ref) {
              var displayName = typeof type2 === "function" ? type2.displayName || type2.name || "Unknown" : type2;
              if (key) {
                defineKeyPropWarningGetter(props, displayName);
              }
              if (ref) {
                defineRefPropWarningGetter(props, displayName);
              }
            }
            return ReactElement(type2, key, ref, self, source, ReactCurrentOwner.current, props);
          }
        }
        __name(jsxDEV, "jsxDEV");
        var ReactCurrentOwner$1 = ReactSharedInternals.ReactCurrentOwner;
        var ReactDebugCurrentFrame$1 = ReactSharedInternals.ReactDebugCurrentFrame;
        function setCurrentlyValidatingElement$1(element) {
          {
            if (element) {
              var owner = element._owner;
              var stack = describeUnknownElementTypeFrameInDEV(element.type, element._source, owner ? owner.type : null);
              ReactDebugCurrentFrame$1.setExtraStackFrame(stack);
            } else {
              ReactDebugCurrentFrame$1.setExtraStackFrame(null);
            }
          }
        }
        __name(setCurrentlyValidatingElement$1, "setCurrentlyValidatingElement$1");
        var propTypesMisspellWarningShown;
        {
          propTypesMisspellWarningShown = false;
        }
        function isValidElement(object2) {
          {
            return typeof object2 === "object" && object2 !== null && object2.$$typeof === REACT_ELEMENT_TYPE;
          }
        }
        __name(isValidElement, "isValidElement");
        function getDeclarationErrorAddendum() {
          {
            if (ReactCurrentOwner$1.current) {
              var name = getComponentNameFromType(ReactCurrentOwner$1.current.type);
              if (name) {
                return "\n\nCheck the render method of `" + name + "`.";
              }
            }
            return "";
          }
        }
        __name(getDeclarationErrorAddendum, "getDeclarationErrorAddendum");
        function getSourceInfoErrorAddendum(source) {
          {
            if (source !== void 0) {
              var fileName = source.fileName.replace(/^.*[\\\/]/, "");
              var lineNumber = source.lineNumber;
              return "\n\nCheck your code at " + fileName + ":" + lineNumber + ".";
            }
            return "";
          }
        }
        __name(getSourceInfoErrorAddendum, "getSourceInfoErrorAddendum");
        var ownerHasKeyUseWarning = {};
        function getCurrentComponentErrorInfo(parentType) {
          {
            var info = getDeclarationErrorAddendum();
            if (!info) {
              var parentName = typeof parentType === "string" ? parentType : parentType.displayName || parentType.name;
              if (parentName) {
                info = "\n\nCheck the top-level render call using <" + parentName + ">.";
              }
            }
            return info;
          }
        }
        __name(getCurrentComponentErrorInfo, "getCurrentComponentErrorInfo");
        function validateExplicitKey(element, parentType) {
          {
            if (!element._store || element._store.validated || element.key != null) {
              return;
            }
            element._store.validated = true;
            var currentComponentErrorInfo = getCurrentComponentErrorInfo(parentType);
            if (ownerHasKeyUseWarning[currentComponentErrorInfo]) {
              return;
            }
            ownerHasKeyUseWarning[currentComponentErrorInfo] = true;
            var childOwner = "";
            if (element && element._owner && element._owner !== ReactCurrentOwner$1.current) {
              childOwner = " It was passed a child from " + getComponentNameFromType(element._owner.type) + ".";
            }
            setCurrentlyValidatingElement$1(element);
            error2('Each child in a list should have a unique "key" prop.%s%s See https://reactjs.org/link/warning-keys for more information.', currentComponentErrorInfo, childOwner);
            setCurrentlyValidatingElement$1(null);
          }
        }
        __name(validateExplicitKey, "validateExplicitKey");
        function validateChildKeys(node2, parentType) {
          {
            if (typeof node2 !== "object") {
              return;
            }
            if (isArray(node2)) {
              for (var i = 0; i < node2.length; i++) {
                var child2 = node2[i];
                if (isValidElement(child2)) {
                  validateExplicitKey(child2, parentType);
                }
              }
            } else if (isValidElement(node2)) {
              if (node2._store) {
                node2._store.validated = true;
              }
            } else if (node2) {
              var iteratorFn = getIteratorFn(node2);
              if (typeof iteratorFn === "function") {
                if (iteratorFn !== node2.entries) {
                  var iterator = iteratorFn.call(node2);
                  var step;
                  while (!(step = iterator.next()).done) {
                    if (isValidElement(step.value)) {
                      validateExplicitKey(step.value, parentType);
                    }
                  }
                }
              }
            }
          }
        }
        __name(validateChildKeys, "validateChildKeys");
        function validatePropTypes(element) {
          {
            var type2 = element.type;
            if (type2 === null || type2 === void 0 || typeof type2 === "string") {
              return;
            }
            var propTypes;
            if (typeof type2 === "function") {
              propTypes = type2.propTypes;
            } else if (typeof type2 === "object" && (type2.$$typeof === REACT_FORWARD_REF_TYPE || // Note: Memo only checks outer props here.
            // Inner props are checked in the reconciler.
            type2.$$typeof === REACT_MEMO_TYPE)) {
              propTypes = type2.propTypes;
            } else {
              return;
            }
            if (propTypes) {
              var name = getComponentNameFromType(type2);
              checkPropTypes(propTypes, element.props, "prop", name, element);
            } else if (type2.PropTypes !== void 0 && !propTypesMisspellWarningShown) {
              propTypesMisspellWarningShown = true;
              var _name = getComponentNameFromType(type2);
              error2("Component %s declared `PropTypes` instead of `propTypes`. Did you misspell the property assignment?", _name || "Unknown");
            }
            if (typeof type2.getDefaultProps === "function" && !type2.getDefaultProps.isReactClassApproved) {
              error2("getDefaultProps is only used on classic React.createClass definitions. Use a static property named `defaultProps` instead.");
            }
          }
        }
        __name(validatePropTypes, "validatePropTypes");
        function validateFragmentProps(fragment) {
          {
            var keys = Object.keys(fragment.props);
            for (var i = 0; i < keys.length; i++) {
              var key = keys[i];
              if (key !== "children" && key !== "key") {
                setCurrentlyValidatingElement$1(fragment);
                error2("Invalid prop `%s` supplied to `React.Fragment`. React.Fragment can only have `key` and `children` props.", key);
                setCurrentlyValidatingElement$1(null);
                break;
              }
            }
            if (fragment.ref !== null) {
              setCurrentlyValidatingElement$1(fragment);
              error2("Invalid attribute `ref` supplied to `React.Fragment`.");
              setCurrentlyValidatingElement$1(null);
            }
          }
        }
        __name(validateFragmentProps, "validateFragmentProps");
        var didWarnAboutKeySpread = {};
        function jsxWithValidation(type2, props, key, isStaticChildren, source, self) {
          {
            var validType = isValidElementType(type2);
            if (!validType) {
              var info = "";
              if (type2 === void 0 || typeof type2 === "object" && type2 !== null && Object.keys(type2).length === 0) {
                info += " You likely forgot to export your component from the file it's defined in, or you might have mixed up default and named imports.";
              }
              var sourceInfo = getSourceInfoErrorAddendum(source);
              if (sourceInfo) {
                info += sourceInfo;
              } else {
                info += getDeclarationErrorAddendum();
              }
              var typeString;
              if (type2 === null) {
                typeString = "null";
              } else if (isArray(type2)) {
                typeString = "array";
              } else if (type2 !== void 0 && type2.$$typeof === REACT_ELEMENT_TYPE) {
                typeString = "<" + (getComponentNameFromType(type2.type) || "Unknown") + " />";
                info = " Did you accidentally export a JSX literal instead of a component?";
              } else {
                typeString = typeof type2;
              }
              error2("React.jsx: type is invalid -- expected a string (for built-in components) or a class/function (for composite components) but got: %s.%s", typeString, info);
            }
            var element = jsxDEV(type2, props, key, source, self);
            if (element == null) {
              return element;
            }
            if (validType) {
              var children = props.children;
              if (children !== void 0) {
                if (isStaticChildren) {
                  if (isArray(children)) {
                    for (var i = 0; i < children.length; i++) {
                      validateChildKeys(children[i], type2);
                    }
                    if (Object.freeze) {
                      Object.freeze(children);
                    }
                  } else {
                    error2("React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead.");
                  }
                } else {
                  validateChildKeys(children, type2);
                }
              }
            }
            {
              if (hasOwnProperty.call(props, "key")) {
                var componentName = getComponentNameFromType(type2);
                var keys = Object.keys(props).filter(function(k) {
                  return k !== "key";
                });
                var beforeExample = keys.length > 0 ? "{key: someKey, " + keys.join(": ..., ") + ": ...}" : "{key: someKey}";
                if (!didWarnAboutKeySpread[componentName + beforeExample]) {
                  var afterExample = keys.length > 0 ? "{" + keys.join(": ..., ") + ": ...}" : "{}";
                  error2('A props object containing a "key" prop is being spread into JSX:\n  let props = %s;\n  <%s {...props} />\nReact keys must be passed directly to JSX without using spread:\n  let props = %s;\n  <%s key={someKey} {...props} />', beforeExample, componentName, afterExample, componentName);
                  didWarnAboutKeySpread[componentName + beforeExample] = true;
                }
              }
            }
            if (type2 === REACT_FRAGMENT_TYPE) {
              validateFragmentProps(element);
            } else {
              validatePropTypes(element);
            }
            return element;
          }
        }
        __name(jsxWithValidation, "jsxWithValidation");
        function jsxWithValidationStatic(type2, props, key) {
          {
            return jsxWithValidation(type2, props, key, true);
          }
        }
        __name(jsxWithValidationStatic, "jsxWithValidationStatic");
        function jsxWithValidationDynamic(type2, props, key) {
          {
            return jsxWithValidation(type2, props, key, false);
          }
        }
        __name(jsxWithValidationDynamic, "jsxWithValidationDynamic");
        var jsx5 = jsxWithValidationDynamic;
        var jsxs = jsxWithValidationStatic;
        exports.Fragment = REACT_FRAGMENT_TYPE;
        exports.jsx = jsx5;
        exports.jsxs = jsxs;
      })();
    }
  }
});

// ../node_modules/react/jsx-runtime.js
var require_jsx_runtime = __commonJS({
  "../node_modules/react/jsx-runtime.js"(exports, module) {
    "use strict";
    init_functionsRoutes_0_8824942990098752();
    if (false) {
      module.exports = null;
    } else {
      module.exports = require_react_jsx_runtime_development();
    }
  }
});

// ../node_modules/@markdoc/markdoc/dist/index.mjs
function isAst(value) {
  return !!value?.$$mdtype;
}
function isFunction(value) {
  return !!(value?.$$mdtype === "Function");
}
function isVariable(value) {
  return !!(value?.$$mdtype === "Variable");
}
function* getAstValues(value) {
  if (value == null || typeof value !== "object")
    return;
  if (Array.isArray(value))
    for (const v of value)
      yield* getAstValues(v);
  if (isAst(value))
    yield value;
  if (Object.getPrototypeOf(value) !== Object.prototype)
    return;
  for (const v of Object.values(value))
    yield* getAstValues(v);
}
function resolve(value, config2 = {}) {
  if (value == null || typeof value !== "object")
    return value;
  if (Array.isArray(value))
    return value.map((item2) => resolve(item2, config2));
  if (isAst(value) && value?.resolve instanceof Function)
    return value.resolve(config2);
  if (Object.getPrototypeOf(value) !== Object.prototype)
    return value;
  const output = {};
  for (const [k, v] of Object.entries(value))
    output[k] = resolve(v, config2);
  return output;
}
function isIdentifier(s2) {
  return typeof s2 === "string" && IDENTIFIER_REGEX.test(s2);
}
function isPromise(a) {
  return a && typeof a === "object" && typeof a.then === "function";
}
function findTagEnd(content, start = 0) {
  let state = 0;
  for (let pos = start; pos < content.length; pos++) {
    const char = content[pos];
    switch (state) {
      case 1:
        switch (char) {
          case '"':
            state = 0;
            break;
          case "\\":
            state = 2;
            break;
        }
        break;
      case 2:
        state = 1;
        break;
      case 0:
        if (char === '"')
          state = 1;
        else if (content.startsWith(CLOSE, pos))
          return pos;
    }
  }
  return null;
}
function parseTag(content, line, contentStart) {
  try {
    return (0, import_tag.parse)(content, { Variable, Function: Function2 });
  } catch (error2) {
    if (!(error2 instanceof import_tag.SyntaxError))
      throw error2;
    const {
      message,
      location: { start, end }
    } = error2;
    const location = {
      start: { line, character: start.offset + contentStart },
      end: { line: line + 1, character: end.offset + contentStart }
    };
    return { type: "error", meta: { error: { message, location } } };
  }
}
function parseTags(content, firstLine = 0) {
  let line = firstLine + 1;
  const output = [];
  let start = 0;
  for (let pos = 0; pos < content.length; pos++) {
    if (content[pos] === "\n") {
      line++;
      continue;
    }
    if (!content.startsWith(OPEN, pos))
      continue;
    const end = findTagEnd(content, pos);
    if (end == null) {
      pos = pos + OPEN.length;
      continue;
    }
    const text22 = content.slice(pos, end + CLOSE.length);
    const inner = content.slice(pos + OPEN.length, end);
    const lineStart = content.lastIndexOf("\n", pos);
    const lineEnd = content.indexOf("\n", end);
    const lineContent = content.slice(lineStart, lineEnd);
    const tag = parseTag(inner.trim(), line, pos - lineStart);
    const precedingTextEnd = lineContent.trim() === text22 ? lineStart : pos;
    const precedingText = content.slice(start, precedingTextEnd);
    output.push({
      type: "text",
      start,
      end: pos - 1,
      content: precedingText
    });
    output.push({
      map: [line, line + 1],
      position: {
        start: pos - lineStart,
        end: pos - lineStart + text22.length
      },
      start: pos,
      end: pos + text22.length - 1,
      info: text22,
      ...tag
    });
    start = end + CLOSE.length;
    pos = start - 1;
  }
  output.push({
    type: "text",
    start,
    end: content.length - 1,
    content: content.slice(start)
  });
  return output;
}
function reviver(_, value) {
  if (!value)
    return value;
  const klass = AstTypes[value.$$mdtype];
  return klass ? Object.assign(new klass(), value) : value;
}
function fromJSON(text22) {
  return JSON.parse(text22, reviver);
}
function* formatChildren(a, options) {
  for (const child2 of a.children) {
    yield* formatValue(child2, options);
  }
}
function* formatInline(g) {
  yield [...g].join("").trim();
}
function* formatTableRow(items) {
  yield `| ${items.join(" | ")} |`;
}
function formatScalar(v) {
  if (v === void 0) {
    return void 0;
  }
  if (ast_default.isAst(v)) {
    return format(v);
  }
  if (v === null) {
    return "null";
  }
  if (Array.isArray(v)) {
    return "[" + v.map(formatScalar).join(SEP) + "]";
  }
  if (typeof v === "object") {
    return "{" + Object.entries(v).map(([key, value]) => `${isIdentifier(key) ? key : `"${key}"`}: ${formatScalar(value)}`).join(SEP) + "}";
  }
  return JSON.stringify(v);
}
function formatAnnotationValue(a) {
  const formattedValue = formatScalar(a.value);
  if (formattedValue === void 0)
    return void 0;
  if (a.name === "primary")
    return formattedValue;
  if (a.name === "id" && typeof a.value === "string" && isIdentifier(a.value))
    return "#" + a.value;
  if (a.type === "class" && isIdentifier(a.name))
    return "." + a.name;
  return `${a.name}=${formattedValue}`;
}
function* formatAttributes(n) {
  for (const [key, value] of Object.entries(n.attributes)) {
    if (key === "class" && typeof value === "object" && !ast_default.isAst(value))
      for (const name of Object.keys(value)) {
        yield formatAnnotationValue({ type: "class", name, value });
      }
    else
      yield formatAnnotationValue({ type: "attribute", name: key, value });
  }
}
function* formatAnnotations(n) {
  if (n.annotations.length) {
    yield OPEN + SPACE;
    yield n.annotations.map(formatAnnotationValue).join(SPACE);
    yield SPACE + CLOSE;
  }
}
function* formatVariable(v) {
  yield "$";
  yield v.path.map((p, i) => {
    if (i === 0)
      return p;
    if (isIdentifier(p))
      return "." + p;
    if (typeof p === "number")
      return `[${p}]`;
    return `["${p}"]`;
  }).join("");
}
function* formatFunction(f) {
  yield f.name;
  yield "(";
  yield Object.values(f.parameters).map(formatScalar).join(SEP);
  yield ")";
}
function* trimStart(g) {
  let n;
  do {
    const { value, done } = g.next();
    if (done)
      return;
    n = value.trimStart();
  } while (!n.length);
  yield n;
  yield* g;
}
function* escapeMarkdownCharacters(s2, characters) {
  yield s2.replace(characters, "\\$&").replace(new RegExp("\xA0", "g"), "&nbsp;");
}
function* formatNode(n, o = {}) {
  const no = { ...o, parent: n };
  const indent = SPACE.repeat(no.indent || 0);
  switch (n.type) {
    case "document": {
      if (n.attributes.frontmatter && n.attributes.frontmatter.length) {
        yield "---" + NL + n.attributes.frontmatter + NL + "---" + NL + NL;
      }
      yield* trimStart(formatChildren(n, no));
      break;
    }
    case "heading": {
      yield NL;
      yield indent;
      yield "#".repeat(n.attributes.level || 1);
      yield SPACE;
      yield* trimStart(formatChildren(n, no));
      yield* formatAnnotations(n);
      yield NL;
      break;
    }
    case "paragraph": {
      yield NL;
      yield* formatChildren(n, no);
      yield* formatAnnotations(n);
      yield NL;
      break;
    }
    case "inline": {
      yield indent;
      yield* formatChildren(n, no);
      break;
    }
    case "image": {
      yield "!";
      yield "[";
      yield* formatValue(n.attributes.alt, no);
      yield "]";
      yield "(";
      yield* typeof n.attributes.src === "string" ? escapeMarkdownCharacters(n.attributes.src, /[()]/) : formatValue(n.attributes.src, no);
      if (n.attributes.title) {
        yield SPACE + `"${n.attributes.title}"`;
      }
      yield ")";
      break;
    }
    case "link": {
      yield "[";
      yield* formatChildren(n, no);
      yield "]";
      yield "(";
      yield* typeof n.attributes.href === "string" ? escapeMarkdownCharacters(n.attributes.href, /[()]/g) : formatValue(n.attributes.href, no);
      if (n.attributes.title) {
        yield SPACE + `"${n.attributes.title}"`;
      }
      yield ")";
      break;
    }
    case "text": {
      const { content } = n.attributes;
      if (ast_default.isAst(content)) {
        yield OPEN + SPACE;
        yield* formatValue(content, no);
        yield SPACE + CLOSE;
      } else {
        if (o.parent && WRAPPING_TYPES.includes(o.parent.type)) {
          yield* escapeMarkdownCharacters(content, /[*_~]/g);
        } else {
          yield* escapeMarkdownCharacters(content, /^[*>#]/);
        }
      }
      break;
    }
    case "blockquote": {
      const prefix = ">" + SPACE;
      yield n.children.map((child2) => format(child2, no).trimStart()).map((d) => NL + indent + prefix + d).join(indent + prefix);
      break;
    }
    case "hr": {
      yield NL;
      yield indent;
      yield "---";
      yield NL;
      break;
    }
    case "fence": {
      yield NL;
      yield indent;
      const innerFence = n.attributes.content.match(/`{3,}/g) || [];
      const innerFenceLength = innerFence.map((s2) => s2.length).reduce(max, 0);
      const boundary = "`".repeat(innerFenceLength ? innerFenceLength + 1 : 3);
      yield boundary;
      if (n.attributes.language)
        yield n.attributes.language;
      if (n.annotations.length)
        yield SPACE;
      yield* formatAnnotations(n);
      yield NL;
      yield indent;
      yield n.attributes.content.split(NL).join(NL + indent);
      yield boundary;
      yield NL;
      break;
    }
    case "tag": {
      if (!n.inline) {
        yield NL;
        yield indent;
      }
      const open = OPEN + SPACE;
      const attributes = [...formatAttributes(n)].filter((v) => v !== void 0);
      const tag = [open + n.tag, ...attributes];
      const inlineTag = tag.join(SPACE);
      const isLongTagOpening = inlineTag.length + open.length * 2 > (o.maxTagOpeningWidth || MAX_TAG_OPENING_WIDTH);
      yield (!n.inline && isLongTagOpening ? tag.join(NL + SPACE.repeat(open.length) + indent) : inlineTag) + SPACE + (n.children.length ? "" : "/") + CLOSE;
      if (n.children.length) {
        yield* formatChildren(n, no.allowIndentation ? increment(no) : no);
        if (!n.inline) {
          yield indent;
        }
        yield OPEN + SPACE + "/" + n.tag + SPACE + CLOSE;
      }
      if (!n.inline) {
        yield NL;
      }
      break;
    }
    case "list": {
      const isLoose = n.children.some((n2) => n2.children.some((c) => c.type === "paragraph"));
      for (let i = 0; i < n.children.length; i++) {
        const prefix = n.attributes.ordered ? `${i === 0 ? n.attributes.start ?? "1" : "1"}${n.attributes.marker ?? OL}` : n.attributes.marker ?? UL;
        let d = format(n.children[i], increment(no, prefix.length + 1));
        if (!isLoose || i === n.children.length - 1) {
          d = d.trim();
        }
        yield NL + indent + prefix + " " + d;
      }
      yield NL;
      break;
    }
    case "item": {
      for (let i = 0; i < n.children.length; i++) {
        yield* formatValue(n.children[i], no);
        if (i === 0)
          yield* formatAnnotations(n);
      }
      break;
    }
    case "strong": {
      yield n.attributes.marker ?? "**";
      yield* formatInline(formatChildren(n, no));
      yield n.attributes.marker ?? "**";
      break;
    }
    case "em": {
      yield n.attributes.marker ?? "*";
      yield* formatInline(formatChildren(n, no));
      yield n.attributes.marker ?? "*";
      break;
    }
    case "code": {
      yield "`";
      yield* formatInline(formatValue(n.attributes.content, no));
      yield "`";
      break;
    }
    case "s": {
      yield "~~";
      yield* formatInline(formatChildren(n, no));
      yield "~~";
      break;
    }
    case "hardbreak": {
      yield "\\" + NL;
      yield indent;
      break;
    }
    case "softbreak": {
      yield NL;
      yield indent;
      break;
    }
    case "table": {
      const table3 = [...formatChildren(n, increment(no))];
      if (o.parent && o.parent.type === "tag" && o.parent.tag === "table") {
        for (let i = 0; i < table3.length; i++) {
          const row = table3[i];
          if (typeof row === "string") {
            if (row.trim().length) {
              yield NL;
              yield row;
            }
          } else {
            if (i !== 0) {
              yield NL;
              yield indent + "---";
            }
            for (const d of row) {
              yield NL + indent + UL + " " + d;
            }
          }
        }
        yield NL;
      } else {
        const widths = [];
        for (const row of table3) {
          for (let i = 0; i < row.length; i++) {
            widths[i] = widths[i] ? Math.max(widths[i], row[i].length) : row[i].length;
          }
        }
        const [head, ...rows] = table3;
        yield NL;
        yield* formatTableRow(head.map((cell, i) => cell + SPACE.repeat(widths[i] - cell.length)));
        yield NL;
        yield* formatTableRow(head.map((cell, i) => "-".repeat(widths[i])));
        yield NL;
        for (const row of rows) {
          yield* formatTableRow(row.map((cell, i) => cell + SPACE.repeat(widths[i] - cell.length)));
          yield NL;
        }
      }
      break;
    }
    case "thead": {
      const [head] = [...formatChildren(n, no)];
      yield head || [];
      break;
    }
    case "tr": {
      yield [...formatChildren(n, no)];
      break;
    }
    case "td":
    case "th": {
      yield [...formatChildren(n, no), ...formatAnnotations(n)].join("").trim();
      break;
    }
    case "tbody": {
      yield* formatChildren(n, no);
      break;
    }
    case "comment": {
      yield "<!-- " + n.attributes.content + " -->\n";
      break;
    }
    case "error":
    case "node":
      break;
  }
}
function* formatValue(v, o = {}) {
  switch (typeof v) {
    case "undefined":
      break;
    case "boolean":
    case "number":
    case "string": {
      yield v.toString();
      break;
    }
    case "object": {
      if (v === null)
        break;
      if (Array.isArray(v)) {
        for (const n of v)
          yield* formatValue(n, o);
        break;
      }
      switch (v.$$mdtype) {
        case "Function": {
          yield* formatFunction(v);
          break;
        }
        case "Node":
          yield* formatNode(v, o);
          break;
        case "Variable": {
          yield* formatVariable(v);
          break;
        }
        default:
          throw new Error(`Unimplemented: "${v.$$mdtype}"`);
      }
      break;
    }
  }
}
function format(v, options) {
  let doc = "";
  for (const s2 of formatValue(v, options))
    doc += s2;
  return doc.trimStart();
}
function truthy(value) {
  return value !== false && value !== void 0 && value !== null;
}
function renderConditions(node2) {
  const conditions = [
    { condition: node2.attributes.primary, children: [] }
  ];
  for (const child2 of node2.children) {
    if (child2.type === "tag" && child2.tag === "else")
      conditions.push({
        condition: "primary" in child2.attributes ? child2.attributes.primary : true,
        children: []
      });
    else
      conditions[conditions.length - 1].children.push(child2);
  }
  return conditions;
}
function convertToRow(node2, cellType = "td") {
  node2.type = "tr";
  node2.attributes = {};
  for (const cell of node2.children)
    cell.type = cellType;
  return node2;
}
function transform(document22) {
  for (const node2 of document22.walk()) {
    if (node2.type !== "tag" || node2.tag !== "table")
      continue;
    const [first, ...rest] = node2.children;
    if (!first || first.type === "table")
      continue;
    const table3 = new ast_default.Node("table", node2.attributes, [
      new ast_default.Node("thead"),
      new ast_default.Node("tbody")
    ]);
    const [thead2, tbody2] = table3.children;
    if (first.type === "list")
      thead2.push(convertToRow(first, "th"));
    for (const row of rest) {
      if (row.type === "list")
        convertToRow(row);
      else if (row.type === "tag" && row.tag === "if") {
        const children = [];
        for (const child2 of row.children) {
          if (child2.type === "hr")
            continue;
          if (child2.type === "list")
            convertToRow(child2);
          children.push(child2);
        }
        row.children = children;
      } else
        continue;
      tbody2.push(row);
    }
    node2.children = [table3];
  }
}
function annotate(node2, attributes) {
  for (const attribute of attributes) {
    node2.annotations.push(attribute);
    const { name, value, type: type2 } = attribute;
    if (type2 === "attribute") {
      if (node2.attributes[name] !== void 0)
        node2.errors.push({
          id: "duplicate-attribute",
          level: "warning",
          message: `Attribute '${name}' already set`
        });
      node2.attributes[name] = value;
    } else if (type2 === "class")
      if (node2.attributes.class)
        node2.attributes.class[name] = value;
      else
        node2.attributes.class = { [name]: value };
  }
}
function handleAttrs(token, type2) {
  switch (type2) {
    case "heading":
      return { level: Number(token.tag.replace("h", "")) };
    case "list": {
      const attrs = token.attrs ? Object.fromEntries(token.attrs) : void 0;
      const ordered = token.type.startsWith("ordered");
      return ordered && attrs?.start ? { ordered: true, start: attrs.start, marker: token.markup } : { ordered, marker: token.markup };
    }
    case "link": {
      const attrs = Object.fromEntries(token.attrs);
      return attrs.title ? { href: attrs.href, title: attrs.title } : { href: attrs.href };
    }
    case "image": {
      const attrs = Object.fromEntries(token.attrs);
      return attrs.title ? { alt: token.content, src: attrs.src, title: attrs.title } : { alt: token.content, src: attrs.src };
    }
    case "em":
    case "strong":
      return { marker: token.markup };
    case "text":
    case "code":
    case "comment":
      return { content: (token.meta || {}).variable || token.content };
    case "fence": {
      const [language] = token.info.split(" ", 1);
      return language === "" || language === OPEN ? { content: token.content } : { content: token.content, language };
    }
    case "td":
    case "th": {
      if (token.attrs) {
        const attrs = Object.fromEntries(token.attrs);
        let align;
        if (attrs.style) {
          if (attrs.style.includes("left")) {
            align = "left";
          } else if (attrs.style.includes("center")) {
            align = "center";
          } else if (attrs.style.includes("right")) {
            align = "right";
          }
        }
        if (align) {
          return { align };
        }
      }
      return {};
    }
    default:
      return {};
  }
}
function handleToken(token, nodes, file2, handleSlots, addLocation, inlineParent) {
  if (token.type === "frontmatter") {
    nodes[0].attributes.frontmatter = token.content;
    return;
  }
  if (token.hidden || token.type === "text" && token.content === "")
    return;
  const errors = token.errors || [];
  const parent = nodes[nodes.length - 1];
  const { tag, attributes, error: error2 } = token.meta || {};
  if (token.type === "annotation") {
    if (inlineParent)
      return annotate(inlineParent, attributes);
    return parent.errors.push({
      id: "no-inline-annotations",
      level: "error",
      message: `Can't apply inline annotations to '${parent.type}'`
    });
  }
  let typeName = token.type.replace(/_(open|close)$/, "");
  if (mappings[typeName])
    typeName = mappings[typeName];
  if (typeName === "error") {
    const { message, location } = error2;
    errors.push({ id: "parse-error", level: "critical", message, location });
  }
  if (token.nesting < 0) {
    if (parent.type === typeName && parent.tag === tag) {
      if (parent.lines && token.map)
        parent.lines.push(...token.map);
      return nodes.pop();
    }
    errors.push({
      id: "missing-opening",
      level: "critical",
      message: `Node '${typeName}' is missing opening`
    });
  }
  const attrs = handleAttrs(token, typeName);
  const node2 = new Node(typeName, attrs, void 0, tag || void 0);
  const { position = {} } = token;
  node2.errors = errors;
  if (addLocation !== false) {
    node2.lines = token.map || parent.lines || [];
    node2.location = {
      file: file2,
      start: {
        line: node2.lines[0],
        character: position.start
      },
      end: {
        line: node2.lines[1],
        character: position.end
      }
    };
  }
  if (inlineParent)
    node2.inline = true;
  if (attributes && ["tag", "fence", "image"].includes(typeName))
    annotate(node2, attributes);
  if (handleSlots && tag === "slot" && typeof node2.attributes.primary === "string")
    parent.slots[node2.attributes.primary] = node2;
  else
    parent.push(node2);
  if (token.nesting > 0)
    nodes.push(node2);
  if (!Array.isArray(token.children))
    return;
  if (node2.type === "inline")
    inlineParent = parent;
  nodes.push(node2);
  const isLeafNode = typeName === "image";
  if (!isLeafNode) {
    for (const child2 of token.children)
      handleToken(child2, nodes, file2, handleSlots, addLocation, inlineParent);
  }
  nodes.pop();
}
function parser(tokens, args) {
  const doc = new Node("document");
  const nodes = [doc];
  if (typeof args === "string")
    args = { file: args };
  for (const token of tokens)
    handleToken(token, nodes, args?.file, args?.slots, args?.location);
  if (nodes.length > 1)
    for (const node2 of nodes.slice(1))
      node2.errors.push({
        id: "missing-closing",
        level: "critical",
        message: `Node '${node2.tag || node2.type}' is missing closing`
      });
  for (const transform3 of transforms_default)
    transform3(doc);
  return doc;
}
function render(node2) {
  if (typeof node2 === "string" || typeof node2 === "number")
    return escapeHtml(String(node2));
  if (Array.isArray(node2))
    return node2.map(render).join("");
  if (node2 === null || typeof node2 !== "object" || !Tag.isTag(node2))
    return "";
  const { name, attributes, children = [] } = node2;
  if (!name)
    return render(children);
  let output = `<${name}`;
  for (const [k, v] of Object.entries(attributes ?? {}))
    output += ` ${k.toLowerCase()}="${escapeHtml(String(v))}"`;
  output += ">";
  if (voidElements.has(name))
    return output;
  if (children.length)
    output += render(children);
  output += `</${name}>`;
  return output;
}
function tagName(name, components) {
  return typeof name !== "string" ? name : name[0] !== name[0].toUpperCase() ? name : components instanceof Function ? components(name) : components[name];
}
function dynamic(node2, React, { components = {} } = {}) {
  function deepRender2(value) {
    if (value == null || typeof value !== "object")
      return value;
    if (Array.isArray(value))
      return value.map((item2) => deepRender2(item2));
    if (value.$$mdtype === "Tag")
      return render3(value);
    if (typeof value !== "object")
      return value;
    const output = {};
    for (const [k, v] of Object.entries(value))
      output[k] = deepRender2(v);
    return output;
  }
  __name(deepRender2, "deepRender2");
  function render3(node3) {
    if (Array.isArray(node3))
      return React.createElement(React.Fragment, null, ...node3.map(render3));
    if (node3 === null || typeof node3 !== "object" || !Tag.isTag(node3))
      return node3;
    const {
      name,
      attributes: { class: className, ...attrs } = {},
      children = []
    } = node3;
    if (className)
      attrs.className = className;
    return React.createElement(tagName(name, components), Object.keys(attrs).length == 0 ? null : deepRender2(attrs), ...children.map(render3));
  }
  __name(render3, "render3");
  return render3(node2);
}
function tagName2(name, components) {
  return typeof name !== "string" ? "Fragment" : name[0] !== name[0].toUpperCase() ? name : components instanceof Function ? components(name) : components[name];
}
function renderArray(children) {
  return children.map(render2).join(", ");
}
function deepRender(value) {
  if (value == null || typeof value !== "object")
    return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${value.map((item2) => deepRender(item2)).join(", ")}]`;
  if (value.$$mdtype === "Tag")
    return render2(value);
  if (typeof value !== "object")
    return JSON.stringify(value);
  const object2 = Object.entries(value).map(([k, v]) => [JSON.stringify(k), deepRender(v)].join(": ")).join(", ");
  return `{${object2}}`;
}
function render2(node2) {
  if (Array.isArray(node2))
    return `React.createElement(React.Fragment, null, ${renderArray(node2)})`;
  if (node2 === null || typeof node2 !== "object" || !Tag.isTag(node2))
    return JSON.stringify(node2);
  const {
    name,
    attributes: { class: className, ...attrs } = {},
    children = []
  } = node2;
  if (className)
    attrs.className = className;
  return `React.createElement(
    tagName(${JSON.stringify(name)}, components),
    ${Object.keys(attrs).length == 0 ? "null" : deepRender(attrs)},
    ${renderArray(children)})`;
}
function reactStatic(node2) {
  return `
  (({components = {}} = {}) => {
    ${tagName2}
    return ${render2(node2)};
  })
`;
}
function createToken(state, content, contentStart) {
  try {
    const { type: type2, meta, nesting = 0 } = (0, import_tag7.parse)(content, { Variable, Function: Function2 });
    const token = state.push(type2, "", nesting);
    token.info = content;
    token.meta = meta;
    if (!state.delimiters) {
      state.delimiters = [];
    }
    return token;
  } catch (error2) {
    if (!(error2 instanceof import_tag7.SyntaxError))
      throw error2;
    const {
      message,
      location: { start, end }
    } = error2;
    const location = contentStart ? {
      start: { offset: start.offset + contentStart },
      end: { offset: end.offset + contentStart }
    } : null;
    const token = state.push("error", "", 0);
    token.meta = { error: { message, location } };
    return token;
  }
}
function block(state, startLine, endLine, silent) {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const finish = state.eMarks[startLine];
  if (!state.src.startsWith(OPEN, start))
    return false;
  const tagEnd = findTagEnd(state.src, start);
  const lastPossible = state.src.slice(0, finish).trim().length;
  if (!tagEnd || tagEnd < lastPossible - CLOSE.length)
    return false;
  const contentStart = start + OPEN.length;
  const content = state.src.slice(contentStart, tagEnd).trim();
  const lines = state.src.slice(start, tagEnd + CLOSE.length).split("\n").length;
  if (content[0] === "$")
    return false;
  if (silent)
    return true;
  const token = createToken(state, content, contentStart);
  token.map = [startLine, startLine + lines];
  state.line += lines;
  return true;
}
function inline2(state, silent) {
  if (!state.src.startsWith(OPEN, state.pos))
    return false;
  const tagEnd = findTagEnd(state.src, state.pos);
  if (!tagEnd)
    return false;
  const content = state.src.slice(state.pos + OPEN.length, tagEnd);
  if (!silent)
    createToken(state, content.trim());
  state.pos = tagEnd + CLOSE.length;
  return true;
}
function core(state) {
  let token;
  for (token of state.tokens) {
    if (token.type !== "fence")
      continue;
    if (token.info.includes(OPEN)) {
      const start = token.info.indexOf(OPEN);
      const end = findTagEnd(token.info, start);
      const content = token.info.slice(start + OPEN.length, end);
      try {
        const { meta } = (0, import_tag7.parse)(content.trim(), { Variable, Function: Function2 });
        token.meta = meta;
      } catch (error2) {
        if (!(error2 instanceof import_tag7.SyntaxError))
          throw error2;
        if (!token.errors)
          token.errors = [];
        token.errors.push({
          id: "fence-tag-error",
          level: "error",
          message: `Syntax error in fence tag: ${error2.message}`
        });
      }
    }
    if (token?.meta?.attributes?.find((attr) => attr.name === "process" && !attr.value))
      continue;
    token.children = parseTags(token.content, token.map[0]);
  }
}
function plugin(md) {
  md.block.ruler.before("paragraph", "annotations", block, {
    alt: ["paragraph", "blockquote"]
  });
  md.inline.ruler.push("containers", inline2);
  md.core.ruler.push("annotations", core);
}
function getLine(state, n) {
  return state.src.slice(state.bMarks[n], state.eMarks[n]).trim();
}
function findClose(state, endLine) {
  for (let line = 1; line < endLine; line++)
    if (getLine(state, line) === fence2)
      return line;
}
function block2(state, startLine, endLine, silent) {
  if (startLine != 0 || getLine(state, 0) != fence2)
    return false;
  const close = findClose(state, endLine);
  if (!close)
    return false;
  if (silent)
    return true;
  const token = state.push("frontmatter", "", 0);
  token.content = state.src.slice(state.eMarks[0], state.bMarks[close]).trim();
  token.map = [0, close];
  token.hidden = true;
  state.line = close + 1;
  return true;
}
function plugin2(md) {
  md.block.ruler.before("hr", "frontmatter", block2);
}
function block3(state, startLine, endLine, silent) {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  if (!state.src.startsWith(OPEN2, start))
    return false;
  const close = state.src.indexOf(CLOSE2, start);
  if (!close)
    return false;
  if (silent)
    return true;
  const content = state.src.slice(start + OPEN2.length, close);
  const lines = content.split("\n").length;
  const token = state.push("comment", "", 0);
  token.content = content.trim();
  token.map = [startLine, startLine + lines];
  state.line += lines;
  return true;
}
function inline3(state, silent) {
  if (!state.src.startsWith(OPEN2, state.pos))
    return false;
  const close = state.src.indexOf(CLOSE2, state.pos);
  if (!close)
    return false;
  if (silent)
    return true;
  const content = state.src.slice(state.pos + OPEN2.length, close);
  const token = state.push("comment", "", 0);
  token.content = content.trim();
  state.pos = close + CLOSE2.length;
  return true;
}
function plugin3(md) {
  md.block.ruler.before("table", "comment", block3, { alt: ["paragraph"] });
  md.inline.ruler.push("comment", inline3);
}
function validateType(type2, value, config2, key) {
  if (!type2)
    return true;
  if (ast_default.isFunction(value) && config2.validation?.validateFunctions) {
    const schema = config2.functions?.[value.name];
    return !schema?.returns ? true : Array.isArray(schema.returns) ? schema.returns.find((t) => t === type2) !== void 0 : schema.returns === type2;
  }
  if (ast_default.isAst(value))
    return true;
  if (Array.isArray(type2))
    return type2.some((t) => validateType(t, value, config2, key));
  if (typeof type2 === "string")
    type2 = TypeMappings[type2];
  if (typeof type2 === "function") {
    const instance = new type2();
    if (instance.validate) {
      return instance.validate(value, config2, key);
    }
  }
  return value != null && value.constructor === type2;
}
function typeToString(type2) {
  if (typeof type2 === "string")
    return type2;
  if (Array.isArray(type2))
    return type2.map(typeToString).join(" | ");
  return type2.name;
}
function validateFunction(fn, config2) {
  const schema = config2.functions?.[fn.name];
  const errors = [];
  if (!schema)
    return [
      {
        id: "function-undefined",
        level: "critical",
        message: `Undefined function: '${fn.name}'`
      }
    ];
  if (schema.validate)
    errors.push(...schema.validate(fn, config2));
  if (schema.parameters) {
    for (const [key, value] of Object.entries(fn.parameters)) {
      const param = schema.parameters?.[key];
      if (!param) {
        errors.push({
          id: "parameter-undefined",
          level: "error",
          message: `Invalid parameter: '${key}'`
        });
        continue;
      }
      if (ast_default.isAst(value) && !ast_default.isFunction(value))
        continue;
      if (param.type) {
        const valid = validateType(param.type, value, config2, key);
        if (valid === false) {
          errors.push({
            id: "parameter-type-invalid",
            level: "error",
            message: `Parameter '${key}' of '${fn.name}' must be type of '${typeToString(param.type)}'`
          });
        } else if (Array.isArray(valid)) {
          errors.push(...valid);
        }
      }
    }
  }
  for (const [key, { required }] of Object.entries(schema.parameters ?? {}))
    if (required && fn.parameters[key] === void 0)
      errors.push({
        id: "parameter-missing-required",
        level: "error",
        message: `Missing required parameter: '${key}'`
      });
  return errors;
}
function displayMatches(matches, n) {
  if (matches.length <= n)
    return JSON.stringify(matches);
  const items = matches.slice(0, n).map((item2) => JSON.stringify(item2));
  return `[${items.join(",")}, ... ${matches.length - n} more]`;
}
function validator(node2, config2) {
  const schema = node2.findSchema(config2);
  const errors = [...node2.errors || []];
  if (!schema) {
    errors.push({
      id: node2.tag ? "tag-undefined" : "node-undefined",
      level: "critical",
      message: node2.tag ? `Undefined tag: '${node2.tag}'` : `Undefined node: '${node2.type}'`
    });
    return errors;
  }
  if (schema.inline != void 0 && node2.inline !== schema.inline)
    errors.push({
      id: "tag-placement-invalid",
      level: "critical",
      message: `'${node2.tag}' tag should be ${schema.inline ? "inline" : "block"}`
    });
  if (schema.selfClosing && node2.children.length > 0)
    errors.push({
      id: "tag-selfclosing-has-children",
      level: "critical",
      message: `'${node2.tag}' tag should be self-closing`
    });
  const attributes = {
    ...globalAttributes,
    ...schema.attributes
  };
  for (const key of Object.keys(node2.slots)) {
    const slot2 = schema.slots?.[key];
    if (!slot2)
      errors.push({
        id: "slot-undefined",
        level: "error",
        message: `Invalid slot: '${key}'`
      });
  }
  for (let [key, value] of Object.entries(node2.attributes)) {
    const attrib = attributes[key];
    if (!attrib) {
      errors.push({
        id: "attribute-undefined",
        level: "error",
        message: `Invalid attribute: '${key}'`
      });
      continue;
    }
    let { type: type2, matches, errorLevel } = attrib;
    if (ast_default.isAst(value)) {
      if (ast_default.isFunction(value) && config2.validation?.validateFunctions)
        errors.push(...validateFunction(value, config2));
      else if (ast_default.isVariable(value) && config2.variables) {
        let missing = false;
        let variables = config2.variables;
        for (const key2 of value.path) {
          if (!Object.prototype.hasOwnProperty.call(variables, key2)) {
            missing = true;
            break;
          }
          variables = variables[key2];
        }
        if (missing) {
          errors.push({
            id: "variable-undefined",
            level: "error",
            message: `Undefined variable: '${value.path.join(".")}'`
          });
        }
      } else
        continue;
    }
    value = value;
    if (type2) {
      const valid = validateType(type2, value, config2, key);
      if (valid === false) {
        errors.push({
          id: "attribute-type-invalid",
          level: errorLevel || "error",
          message: `Attribute '${key}' must be type of '${typeToString(type2)}'`
        });
      }
      if (Array.isArray(valid)) {
        errors.push(...valid);
      }
    }
    if (typeof matches === "function")
      matches = matches(config2);
    if (Array.isArray(matches) && !matches.includes(value))
      errors.push({
        id: "attribute-value-invalid",
        level: errorLevel || "error",
        message: `Attribute '${key}' must match one of ${displayMatches(matches, 8)}. Got '${value}' instead.`
      });
    if (matches instanceof RegExp && !matches.test(value))
      errors.push({
        id: "attribute-value-invalid",
        level: errorLevel || "error",
        message: `Attribute '${key}' must match ${matches}. Got '${value}' instead.`
      });
    if (typeof attrib.validate === "function") {
      const attribErrors = attrib.validate(value, config2, key);
      if (Array.isArray(attribErrors))
        errors.push(...attribErrors);
    }
  }
  for (const [key, { required }] of Object.entries(attributes))
    if (required && node2.attributes[key] === void 0)
      errors.push({
        id: "attribute-missing-required",
        level: "error",
        message: `Missing required attribute: '${key}'`
      });
  if (schema.slots) {
    for (const [key, { required }] of Object.entries(schema.slots))
      if (required && node2.slots[key] === void 0)
        errors.push({
          id: "slot-missing-required",
          level: "error",
          message: `Missing required slot: '${key}'`
        });
  }
  for (const { type: type2 } of node2.children) {
    if (schema.children && type2 !== "error" && !schema.children.includes(type2))
      errors.push({
        id: "child-invalid",
        level: "warning",
        message: `Can't nest '${type2}' in '${node2.tag || node2.type}'`
      });
  }
  if (schema.validate) {
    const schemaErrors = schema.validate(node2, config2);
    if (isPromise(schemaErrors)) {
      return schemaErrors.then((e) => errors.concat(e));
    }
    errors.push(...schemaErrors);
  }
  return errors;
}
function* walkWithParents(node2, parents = []) {
  yield [node2, parents];
  for (const child2 of [...Object.values(node2.slots), ...node2.children])
    yield* walkWithParents(child2, [...parents, node2]);
}
function validateTree(content, config2) {
  const output = [...walkWithParents(content)].map(([node2, parents]) => {
    const { type: type2, lines, location } = node2;
    const updatedConfig = {
      ...config2,
      validation: { ...config2.validation, parents }
    };
    const errors = validator(node2, updatedConfig);
    if (isPromise(errors)) {
      return errors.then((e) => e.map((error2) => ({ type: type2, lines, location, error: error2 })));
    }
    return errors.map((error2) => ({ type: type2, lines, location, error: error2 }));
  });
  if (output.some(isPromise)) {
    return Promise.all(output).then((o) => o.flat());
  }
  return output.flat();
}
function mergeConfig(config2 = {}) {
  return {
    ...config2,
    tags: {
      ...tags_default,
      ...config2.tags
    },
    nodes: {
      ...schema_exports,
      ...config2.nodes
    },
    functions: {
      ...functions_default,
      ...config2.functions
    }
  };
}
function parse3(content, args) {
  if (typeof content === "string")
    content = tokenizer.tokenize(content);
  return parser(content, args);
}
function resolve2(content, config2) {
  if (Array.isArray(content))
    return content.flatMap((child2) => child2.resolve(config2));
  return content.resolve(config2);
}
function transform2(nodes, options) {
  const config2 = mergeConfig(options);
  const content = resolve2(nodes, config2);
  if (Array.isArray(content))
    return content.flatMap((child2) => child2.transform(config2));
  return content.transform(config2);
}
function validate2(content, options) {
  const config2 = mergeConfig(options);
  return validateTree(content, config2);
}
function createElement(name, attributes = {}, ...children) {
  return { name, attributes, children };
}
var __create2, __defProp2, __getOwnPropDesc2, __getOwnPropNames2, __getProtoOf2, __hasOwnProp2, __markAsModule, __commonJS2, __export, __reExport, __toModule, require_tag, require_entities, require_entities2, require_regex, require_encode, require_decode, require_format, require_parse, require_mdurl, require_regex2, require_regex3, require_regex4, require_regex5, require_uc, require_utils, require_parse_link_label, require_parse_link_destination, require_parse_link_title, require_helpers, require_renderer, require_ruler, require_normalize, require_block, require_inline, require_linkify, require_replacements, require_smartquotes, require_token, require_state_core, require_parser_core, require_table, require_code, require_fence, require_blockquote, require_hr, require_list, require_reference, require_html_blocks, require_html_re, require_html_block, require_heading, require_lheading, require_paragraph, require_state_block, require_parser_block, require_text, require_newline, require_escape, require_backticks, require_strikethrough, require_emphasis, require_link, require_image, require_autolink, require_html_inline, require_entity, require_balance_pairs, require_text_collapse, require_state_inline, require_parser_inline, require_re, require_linkify_it, require_punycode, require_default, require_zero, require_commonmark, require_lib, require_markdown_it, base_exports, Tag, Class, Id, import_tag, Variable, Function2, STATES, OPEN, CLOSE, IDENTIFIER_REGEX, globalAttributes, transformer_default, Node, AstTypes, ast_default, SPACE, SEP, NL, OL, UL, MAX_TAG_OPENING_WIDTH, WRAPPING_TYPES, max, increment, tagIf, tagElse, and, or, not, equals, debug, defaultFn, functions_default, transforms_default, mappings, schema_exports, document, heading, paragraph, image, fence, blockquote, item, list, hr, table, td, th, tr, tbody, thead, strong, em, s, inline, link, code, text, hardbreak, softbreak, comment, error, node, import_markdown_it, escapeHtml, voidElements, renderers_default, PartialFile, partial, table2, slot, tags_default, import_lib, import_tag7, fence2, OPEN2, CLOSE2, Tokenizer, TypeMappings, tokenizer, Markdoc;
var init_dist2 = __esm({
  "../node_modules/@markdoc/markdoc/dist/index.mjs"() {
    init_functionsRoutes_0_8824942990098752();
    __create2 = Object.create;
    __defProp2 = Object.defineProperty;
    __getOwnPropDesc2 = Object.getOwnPropertyDescriptor;
    __getOwnPropNames2 = Object.getOwnPropertyNames;
    __getProtoOf2 = Object.getPrototypeOf;
    __hasOwnProp2 = Object.prototype.hasOwnProperty;
    __markAsModule = /* @__PURE__ */ __name((target) => __defProp2(target, "__esModule", { value: true }), "__markAsModule");
    __commonJS2 = /* @__PURE__ */ __name((cb, mod) => /* @__PURE__ */ __name(function __require() {
      return mod || (0, cb[Object.keys(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    }, "__require"), "__commonJS");
    __export = /* @__PURE__ */ __name((target, all) => {
      __markAsModule(target);
      for (var name in all)
        __defProp2(target, name, { get: all[name], enumerable: true });
    }, "__export");
    __reExport = /* @__PURE__ */ __name((target, module, desc) => {
      if (module && typeof module === "object" || typeof module === "function") {
        for (let key of __getOwnPropNames2(module))
          if (!__hasOwnProp2.call(target, key) && key !== "default")
            __defProp2(target, key, { get: /* @__PURE__ */ __name(() => module[key], "get"), enumerable: !(desc = __getOwnPropDesc2(module, key)) || desc.enumerable });
      }
      return target;
    }, "__reExport");
    __toModule = /* @__PURE__ */ __name((module) => {
      return __reExport(__markAsModule(__defProp2(module != null ? __create2(__getProtoOf2(module)) : {}, "default", module && module.__esModule && "default" in module ? { get: /* @__PURE__ */ __name(() => module.default, "get"), enumerable: true } : { value: module, enumerable: true })), module);
    }, "__toModule");
    require_tag = __commonJS2({
      "src/grammar/tag.js"(exports, module) {
        "use strict";
        function peg$subclass(child2, parent) {
          function C() {
            this.constructor = child2;
          }
          __name(C, "C");
          C.prototype = parent.prototype;
          child2.prototype = new C();
        }
        __name(peg$subclass, "peg$subclass");
        function peg$SyntaxError(message, expected, found, location) {
          this.message = message;
          this.expected = expected;
          this.found = found;
          this.location = location;
          this.name = "SyntaxError";
          if (typeof Error.captureStackTrace === "function") {
            Error.captureStackTrace(this, peg$SyntaxError);
          }
        }
        __name(peg$SyntaxError, "peg$SyntaxError");
        peg$subclass(peg$SyntaxError, Error);
        peg$SyntaxError.buildMessage = function(expected, found, location) {
          var DESCRIBE_EXPECTATION_FNS = {
            literal: /* @__PURE__ */ __name(function(expectation) {
              return '"' + literalEscape(expectation.text) + '"';
            }, "literal"),
            class: /* @__PURE__ */ __name(function(expectation) {
              var escapedParts = expectation.parts.map(function(part) {
                return Array.isArray(part) ? classEscape(part[0]) + "-" + classEscape(part[1]) : classEscape(part);
              });
              return "[" + (expectation.inverted ? "^" : "") + escapedParts + "]";
            }, "class"),
            any: /* @__PURE__ */ __name(function() {
              return "any character";
            }, "any"),
            end: /* @__PURE__ */ __name(function() {
              return "end of input";
            }, "end"),
            other: /* @__PURE__ */ __name(function(expectation) {
              return expectation.description;
            }, "other"),
            not: /* @__PURE__ */ __name(function(expectation) {
              return "not " + describeExpectation(expectation.expected);
            }, "not")
          };
          function hex(ch) {
            return ch.charCodeAt(0).toString(16).toUpperCase();
          }
          __name(hex, "hex");
          function literalEscape(s2) {
            return s2.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\0/g, "\\0").replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/[\x00-\x0F]/g, function(ch) {
              return "\\x0" + hex(ch);
            }).replace(/[\x10-\x1F\x7F-\x9F]/g, function(ch) {
              return "\\x" + hex(ch);
            });
          }
          __name(literalEscape, "literalEscape");
          function classEscape(s2) {
            return s2.replace(/\\/g, "\\\\").replace(/\]/g, "\\]").replace(/\^/g, "\\^").replace(/-/g, "\\-").replace(/\0/g, "\\0").replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/[\x00-\x0F]/g, function(ch) {
              return "\\x0" + hex(ch);
            }).replace(/[\x10-\x1F\x7F-\x9F]/g, function(ch) {
              return "\\x" + hex(ch);
            });
          }
          __name(classEscape, "classEscape");
          function describeExpectation(expectation) {
            return DESCRIBE_EXPECTATION_FNS[expectation.type](expectation);
          }
          __name(describeExpectation, "describeExpectation");
          function describeExpected(expected2) {
            var descriptions = expected2.map(describeExpectation);
            var i, j;
            descriptions.sort();
            if (descriptions.length > 0) {
              for (i = 1, j = 1; i < descriptions.length; i++) {
                if (descriptions[i - 1] !== descriptions[i]) {
                  descriptions[j] = descriptions[i];
                  j++;
                }
              }
              descriptions.length = j;
            }
            switch (descriptions.length) {
              case 1:
                return descriptions[0];
              case 2:
                return descriptions[0] + " or " + descriptions[1];
              default:
                return descriptions.slice(0, -1).join(", ") + ", or " + descriptions[descriptions.length - 1];
            }
          }
          __name(describeExpected, "describeExpected");
          function describeFound(found2) {
            return found2 ? '"' + literalEscape(found2) + '"' : "end of input";
          }
          __name(describeFound, "describeFound");
          return "Expected " + describeExpected(expected) + " but " + describeFound(found) + " found.";
        };
        function peg$parse(input, options) {
          options = options !== void 0 ? options : {};
          var peg$FAILED = {};
          var peg$startRuleFunctions = { Top: peg$parseTop };
          var peg$startRuleFunction = peg$parseTop;
          var peg$c0 = "/";
          var peg$c1 = ".";
          var peg$c2 = "#";
          var peg$c3 = "=";
          var peg$c4 = "(";
          var peg$c5 = ")";
          var peg$c6 = ",";
          var peg$c7 = "[";
          var peg$c8 = "]";
          var peg$c9 = "null";
          var peg$c10 = "true";
          var peg$c11 = "false";
          var peg$c12 = "{";
          var peg$c13 = "}";
          var peg$c14 = ":";
          var peg$c15 = "-";
          var peg$c16 = '"';
          var peg$c17 = "\\";
          var peg$c18 = "n";
          var peg$c19 = "r";
          var peg$c20 = "t";
          var peg$r0 = /^[$@]/;
          var peg$r1 = /^[0-9]/;
          var peg$r2 = /^[^\0-\x1F"\\]/;
          var peg$r3 = /^[a-zA-Z0-9_\-]/;
          var peg$r4 = /^[ \n\t]/;
          var peg$e0 = peg$literalExpectation("/", false);
          var peg$e1 = peg$otherExpectation("tag name");
          var peg$e2 = peg$otherExpectation("class");
          var peg$e3 = peg$otherExpectation("id");
          var peg$e4 = peg$literalExpectation("=", false);
          var peg$e5 = peg$literalExpectation("(", false);
          var peg$e6 = peg$literalExpectation(")", false);
          var peg$e7 = peg$literalExpectation(",", false);
          var peg$e8 = peg$otherExpectation("variable");
          var peg$e9 = peg$otherExpectation("null");
          var peg$e10 = peg$otherExpectation("boolean");
          var peg$e11 = peg$literalExpectation("[", false);
          var peg$e12 = peg$literalExpectation("]", false);
          var peg$e13 = peg$literalExpectation("{", false);
          var peg$e14 = peg$literalExpectation("}", false);
          var peg$e15 = peg$literalExpectation(":", false);
          var peg$e16 = peg$otherExpectation("number");
          var peg$e17 = peg$otherExpectation("string");
          var peg$e18 = peg$otherExpectation("identifier");
          var peg$e19 = peg$otherExpectation("whitespace");
          var peg$f0 = /* @__PURE__ */ __name(function(variable) {
            return { type: "variable", meta: { variable } };
          }, "peg$f0");
          var peg$f1 = /* @__PURE__ */ __name(function(attributes) {
            return { type: "annotation", meta: { attributes } };
          }, "peg$f1");
          var peg$f2 = /* @__PURE__ */ __name(function(tag, value) {
            return value;
          }, "peg$f2");
          var peg$f3 = /* @__PURE__ */ __name(function(tag, primary, attributes, close) {
            if (primary) {
              attributes = attributes || [];
              attributes.unshift({
                type: "attribute",
                name: "primary",
                value: primary
              });
            }
            const [type2, nesting] = close ? ["tag", 0] : ["tag_open", 1];
            return { type: type2, nesting, meta: { tag, attributes } };
          }, "peg$f3");
          var peg$f4 = /* @__PURE__ */ __name(function(tag) {
            return { type: "tag_close", nesting: -1, meta: { tag } };
          }, "peg$f4");
          var peg$f5 = /* @__PURE__ */ __name(function(head, tail) {
            return !head ? [] : [head, ...tail];
          }, "peg$f5");
          var peg$f6 = /* @__PURE__ */ __name(function(item2) {
            return item2;
          }, "peg$f6");
          var peg$f7 = /* @__PURE__ */ __name(function(ids) {
            return ids;
          }, "peg$f7");
          var peg$f8 = /* @__PURE__ */ __name(function(classes) {
            return classes;
          }, "peg$f8");
          var peg$f9 = /* @__PURE__ */ __name(function(attribute) {
            return attribute;
          }, "peg$f9");
          var peg$f10 = /* @__PURE__ */ __name(function(name) {
            return { type: "class", name, value: true };
          }, "peg$f10");
          var peg$f11 = /* @__PURE__ */ __name(function(value) {
            return { type: "attribute", name: "id", value };
          }, "peg$f11");
          var peg$f12 = /* @__PURE__ */ __name(function(name, value) {
            return { type: "attribute", name, value };
          }, "peg$f12");
          var peg$f13 = /* @__PURE__ */ __name(function(name, head, tail) {
            return head ? [head, ...tail] : [];
          }, "peg$f13");
          var peg$f14 = /* @__PURE__ */ __name(function(name, params) {
            let parameters = {};
            for (let [index2, { name: name2, value }] of params.entries())
              parameters[name2 || index2] = value;
            return new Function3(name, parameters);
          }, "peg$f14");
          var peg$f15 = /* @__PURE__ */ __name(function(name) {
            return name;
          }, "peg$f15");
          var peg$f16 = /* @__PURE__ */ __name(function(name, value) {
            return { name, value };
          }, "peg$f16");
          var peg$f17 = /* @__PURE__ */ __name(function(value) {
            return value;
          }, "peg$f17");
          var peg$f18 = /* @__PURE__ */ __name(function(prefix, head, tail) {
            if (prefix === "@")
              return [head, ...tail];
            return new Variable2([head, ...tail]);
          }, "peg$f18");
          var peg$f19 = /* @__PURE__ */ __name(function() {
            return null;
          }, "peg$f19");
          var peg$f20 = /* @__PURE__ */ __name(function() {
            return true;
          }, "peg$f20");
          var peg$f21 = /* @__PURE__ */ __name(function() {
            return false;
          }, "peg$f21");
          var peg$f22 = /* @__PURE__ */ __name(function(head, tail) {
            return [head, ...tail];
          }, "peg$f22");
          var peg$f23 = /* @__PURE__ */ __name(function(value) {
            return value || [];
          }, "peg$f23");
          var peg$f24 = /* @__PURE__ */ __name(function(head, tail) {
            return Object.assign(head, ...tail);
          }, "peg$f24");
          var peg$f25 = /* @__PURE__ */ __name(function(value) {
            return value || {};
          }, "peg$f25");
          var peg$f26 = /* @__PURE__ */ __name(function(key, value) {
            return key === "$$mdtype" ? {} : { [key]: value };
          }, "peg$f26");
          var peg$f27 = /* @__PURE__ */ __name(function() {
            return parseFloat(text22());
          }, "peg$f27");
          var peg$f28 = /* @__PURE__ */ __name(function(value) {
            return value.join("");
          }, "peg$f28");
          var peg$f29 = /* @__PURE__ */ __name(function() {
            return "\n";
          }, "peg$f29");
          var peg$f30 = /* @__PURE__ */ __name(function() {
            return "\r";
          }, "peg$f30");
          var peg$f31 = /* @__PURE__ */ __name(function() {
            return "	";
          }, "peg$f31");
          var peg$f32 = /* @__PURE__ */ __name(function(sequence) {
            return sequence;
          }, "peg$f32");
          var peg$currPos = 0;
          var peg$savedPos = 0;
          var peg$posDetailsCache = [{ line: 1, column: 1 }];
          var peg$expected = [];
          var peg$silentFails = 0;
          var peg$result;
          if ("startRule" in options) {
            if (!(options.startRule in peg$startRuleFunctions)) {
              throw new Error(`Can't start parsing from rule "` + options.startRule + '".');
            }
            peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
          }
          function text22() {
            return input.substring(peg$savedPos, peg$currPos);
          }
          __name(text22, "text2");
          function offset() {
            return peg$savedPos;
          }
          __name(offset, "offset");
          function range() {
            return [peg$savedPos, peg$currPos];
          }
          __name(range, "range");
          function location() {
            return peg$computeLocation(peg$savedPos, peg$currPos);
          }
          __name(location, "location");
          function expected(description, location2) {
            location2 = location2 !== void 0 ? location2 : peg$computeLocation(peg$savedPos, peg$currPos);
            throw peg$buildStructuredError([peg$otherExpectation(description)], input.substring(peg$savedPos, peg$currPos), location2);
          }
          __name(expected, "expected");
          function error2(message, location2) {
            location2 = location2 !== void 0 ? location2 : peg$computeLocation(peg$savedPos, peg$currPos);
            throw peg$buildSimpleError(message, location2);
          }
          __name(error2, "error2");
          function peg$literalExpectation(text3, ignoreCase) {
            return { type: "literal", text: text3, ignoreCase };
          }
          __name(peg$literalExpectation, "peg$literalExpectation");
          function peg$classExpectation(parts, inverted, ignoreCase) {
            return {
              type: "class",
              parts,
              inverted,
              ignoreCase
            };
          }
          __name(peg$classExpectation, "peg$classExpectation");
          function peg$anyExpectation() {
            return { type: "any" };
          }
          __name(peg$anyExpectation, "peg$anyExpectation");
          function peg$endExpectation() {
            return { type: "end" };
          }
          __name(peg$endExpectation, "peg$endExpectation");
          function peg$otherExpectation(description) {
            return { type: "other", description };
          }
          __name(peg$otherExpectation, "peg$otherExpectation");
          function peg$computePosDetails(pos) {
            var details = peg$posDetailsCache[pos];
            var p;
            if (details) {
              return details;
            } else {
              p = pos - 1;
              while (!peg$posDetailsCache[p]) {
                p--;
              }
              details = peg$posDetailsCache[p];
              details = {
                line: details.line,
                column: details.column
              };
              while (p < pos) {
                if (input.charCodeAt(p) === 10) {
                  details.line++;
                  details.column = 1;
                } else {
                  details.column++;
                }
                p++;
              }
              peg$posDetailsCache[pos] = details;
              return details;
            }
          }
          __name(peg$computePosDetails, "peg$computePosDetails");
          var peg$VALIDFILENAME = typeof options.filename === "string" && options.filename.length > 0;
          function peg$computeLocation(startPos, endPos) {
            var loc = {};
            if (peg$VALIDFILENAME)
              loc.filename = options.filename;
            var startPosDetails = peg$computePosDetails(startPos);
            loc.start = {
              offset: startPos,
              line: startPosDetails.line,
              column: startPosDetails.column
            };
            var endPosDetails = peg$computePosDetails(endPos);
            loc.end = {
              offset: endPos,
              line: endPosDetails.line,
              column: endPosDetails.column
            };
            return loc;
          }
          __name(peg$computeLocation, "peg$computeLocation");
          function peg$begin() {
            peg$expected.push({ pos: peg$currPos, variants: [] });
          }
          __name(peg$begin, "peg$begin");
          function peg$expect(expected2) {
            var top = peg$expected[peg$expected.length - 1];
            if (peg$currPos < top.pos) {
              return;
            }
            if (peg$currPos > top.pos) {
              top.pos = peg$currPos;
              top.variants = [];
            }
            top.variants.push(expected2);
          }
          __name(peg$expect, "peg$expect");
          function peg$end(invert) {
            var expected2 = peg$expected.pop();
            var top = peg$expected[peg$expected.length - 1];
            var variants = expected2.variants;
            if (top.pos !== expected2.pos) {
              return;
            }
            if (invert) {
              variants = variants.map(function(e) {
                return e.type === "not" ? e.expected : { type: "not", expected: e };
              });
            }
            Array.prototype.push.apply(top.variants, variants);
          }
          __name(peg$end, "peg$end");
          function peg$buildSimpleError(message, location2) {
            return new peg$SyntaxError(message, null, null, location2);
          }
          __name(peg$buildSimpleError, "peg$buildSimpleError");
          function peg$buildStructuredError(expected2, found, location2) {
            return new peg$SyntaxError(peg$SyntaxError.buildMessage(expected2, found, location2), expected2, found, location2);
          }
          __name(peg$buildStructuredError, "peg$buildStructuredError");
          function peg$buildError() {
            var expected2 = peg$expected[0];
            var failPos = expected2.pos;
            return peg$buildStructuredError(expected2.variants, failPos < input.length ? input.charAt(failPos) : null, failPos < input.length ? peg$computeLocation(failPos, failPos + 1) : peg$computeLocation(failPos, failPos));
          }
          __name(peg$buildError, "peg$buildError");
          function peg$parseTop() {
            var s0;
            var rule$expects = /* @__PURE__ */ __name(function(expected2) {
              if (peg$silentFails === 0)
                peg$expect(expected2);
            }, "rule$expects");
            s0 = peg$parseTopLevelValue();
            if (s0 === peg$FAILED) {
              s0 = peg$parseAnnotation();
              if (s0 === peg$FAILED) {
                s0 = peg$parseTagOpen();
                if (s0 === peg$FAILED) {
                  s0 = peg$parseTagClose();
                }
              }
            }
            return s0;
          }
          __name(peg$parseTop, "peg$parseTop");
          function peg$parseTopLevelValue() {
            var s0, s1;
            var rule$expects = /* @__PURE__ */ __name(function(expected2) {
              if (peg$silentFails === 0)
                peg$expect(expected2);
            }, "rule$expects");
            s0 = peg$currPos;
            s1 = peg$parseVariable();
            if (s1 === peg$FAILED) {
              s1 = peg$parseFunction();
            }
            if (s1 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$f0(s1);
            }
            s0 = s1;
            return s0;
          }
          __name(peg$parseTopLevelValue, "peg$parseTopLevelValue");
          function peg$parseAnnotation() {
            var s0, s1, s2, s3;
            var rule$expects = /* @__PURE__ */ __name(function(expected2) {
              if (peg$silentFails === 0)
                peg$expect(expected2);
            }, "rule$expects");
            s0 = peg$currPos;
            s1 = peg$parseTagAttributes();
            if (s1 !== peg$FAILED) {
              s2 = [];
              s3 = peg$parse_();
              while (s3 !== peg$FAILED) {
                s2.push(s3);
                s3 = peg$parse_();
              }
              peg$savedPos = s0;
              s0 = peg$f1(s1);
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
            return s0;
          }
          __name(peg$parseAnnotation, "peg$parseAnnotation");
          function peg$parseTagOpen() {
            var s0, s1, s2, s3, s4, s5, s6;
            var rule$expects = /* @__PURE__ */ __name(function(expected2) {
              if (peg$silentFails === 0)
                peg$expect(expected2);
            }, "rule$expects");
            s0 = peg$currPos;
            s1 = peg$parseTagName();
            if (s1 !== peg$FAILED) {
              s2 = [];
              s3 = peg$parse_();
              while (s3 !== peg$FAILED) {
                s2.push(s3);
                s3 = peg$parse_();
              }
              s3 = peg$currPos;
              s4 = peg$parseValue();
              if (s4 !== peg$FAILED) {
                s5 = peg$parse_();
                if (s5 === peg$FAILED) {
                  s5 = null;
                }
                peg$savedPos = s3;
                s3 = peg$f2(s1, s4);
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
              if (s3 === peg$FAILED) {
                s3 = null;
              }
              s4 = peg$parseTagAttributes();
              if (s4 === peg$FAILED) {
                s4 = null;
              }
              s5 = [];
              s6 = peg$parse_();
              while (s6 !== peg$FAILED) {
                s5.push(s6);
                s6 = peg$parse_();
              }
              rule$expects(peg$e0);
              if (input.charCodeAt(peg$currPos) === 47) {
                s6 = peg$c0;
                peg$currPos++;
              } else {
                s6 = peg$FAILED;
              }
              if (s6 === peg$FAILED) {
                s6 = null;
              }
              peg$savedPos = s0;
              s0 = peg$f3(s1, s3, s4, s6);
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
            return s0;
          }
          __name(peg$parseTagOpen, "peg$parseTagOpen");
          function peg$parseTagClose() {
            var s0, s1, s2;
            var rule$expects = /* @__PURE__ */ __name(function(expected2) {
              if (peg$silentFails === 0)
                peg$expect(expected2);
            }, "rule$expects");
            s0 = peg$currPos;
            rule$expects(peg$e0);
            if (input.charCodeAt(peg$currPos) === 47) {
              s1 = peg$c0;
              peg$currPos++;
            } else {
              s1 = peg$FAILED;
            }
            if (s1 !== peg$FAILED) {
              s2 = peg$parseTagName();
              if (s2 !== peg$FAILED) {
                peg$savedPos = s0;
                s0 = peg$f4(s2);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
            return s0;
          }
          __name(peg$parseTagClose, "peg$parseTagClose");
          function peg$parseTagName() {
            var s0;
            var rule$expects = /* @__PURE__ */ __name(function(expected2) {
              if (peg$silentFails === 0)
                peg$expect(expected2);
            }, "rule$expects");
            rule$expects(peg$e1);
            peg$silentFails++;
            s0 = peg$parseIdentifier();
            peg$silentFails--;
            return s0;
          }
          __name(peg$parseTagName, "peg$parseTagName");
          function peg$parseTagAttributes() {
            var s0, s1, s2, s3;
            var rule$expects = /* @__PURE__ */ __name(function(expected2) {
              if (peg$silentFails === 0)
                peg$expect(expected2);
            }, "rule$expects");
            s0 = peg$currPos;
            s1 = peg$parseTagAttributesItem();
            if (s1 !== peg$FAILED) {
              s2 = [];
              s3 = peg$parseTagAttributesTail();
              while (s3 !== peg$FAILED) {
                s2.push(s3);
                s3 = peg$parseTagAttributesTail();
              }
              peg$savedPos = s0;
              s0 = peg$f5(s1, s2);
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
            return s0;
          }
          __name(peg$parseTagAttributes, "peg$parseTagAttributes");
          function peg$parseTagAttributesTail() {
            var s0, s1, s2;
            var rule$expects = /* @__PURE__ */ __name(function(expected2) {
              if (peg$silentFails === 0)
                peg$expect(expected2);
            }, "rule$expects");
            s0 = peg$currPos;
            s1 = [];
            s2 = peg$parse_();
            if (s2 !== peg$FAILED) {
              while (s2 !== peg$FAILED) {
                s1.push(s2);
                s2 = peg$parse_();
              }
            } else {
              s1 = peg$FAILED;
            }
            if (s1 !== peg$FAILED) {
              s2 = peg$parseTagAttributesItem();
              if (s2 !== peg$FAILED) {
                peg$savedPos = s0;
                s0 = peg$f6(s2);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
            return s0;
          }
          __name(peg$parseTagAttributesTail, "peg$parseTagAttributesTail");
          function peg$parseTagAttributesItem() {
            var s0, s1;
            var rule$expects = /* @__PURE__ */ __name(function(expected2) {
              if (peg$silentFails === 0)
                peg$expect(expected2);
            }, "rule$expects");
            s0 = peg$currPos;
            s1 = peg$parseTagShortcutId();
            if (s1 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$f7(s1);
            }
            s0 = s1;
            if (s0 === peg$FAILED) {
              s0 = peg$currPos;
              s1 = peg$parseTagShortcutClass();
              if (s1 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$f8(s1);
              }
              s0 = s1;
              if (s0 === peg$FAILED) {
                s0 = peg$currPos;
                s1 = peg$parseTagAttribute();
                if (s1 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s1 = peg$f9(s1);
                }
                s0 = s1;
              }
            }
            return s0;
          }
          __name(peg$parseTagAttributesItem, "peg$parseTagAttributesItem");
          function peg$parseTagShortcutClass() {
            var s0, s1, s2;
            var rule$expects = /* @__PURE__ */ __name(function(expected2) {
              if (peg$silentFails === 0)
                peg$expect(expected2);
            }, "rule$expects");
            rule$expects(peg$e2);
            peg$silentFails++;
            s0 = peg$currPos;
            if (input.charCodeAt(peg$currPos) === 46) {
              s1 = peg$c1;
              peg$currPos++;
            } else {
              s1 = peg$FAILED;
            }
            if (s1 !== peg$FAILED) {
              s2 = peg$parseIdentifier();
              if (s2 !== peg$FAILED) {
                peg$savedPos = s0;
                s0 = peg$f10(s2);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
            peg$silentFails--;
            return s0;
          }
          __name(peg$parseTagShortcutClass, "peg$parseTagShortcutClass");
          function peg$parseTagShortcutId() {
            var s0, s1, s2;
            var rule$expects = /* @__PURE__ */ __name(function(expected2) {
              if (peg$silentFails === 0)
                peg$expect(expected2);
            }, "rule$expects");
            rule$expects(peg$e3);
            peg$silentFails++;
            s0 = peg$currPos;
            if (input.charCodeAt(peg$currPos) === 35) {
              s1 = peg$c2;
              peg$currPos++;
            } else {
              s1 = peg$FAILED;
            }
            if (s1 !== peg$FAILED) {
              s2 = peg$parseIdentifier();
              if (s2 !== peg$FAILED) {
                peg$savedPos = s0;
                s0 = peg$f11(s2);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
            peg$silentFails--;
            return s0;
          }
          __name(peg$parseTagShortcutId, "peg$parseTagShortcutId");
          function peg$parseTagAttribute() {
            var s0, s1, s2, s3;
            var rule$expects = /* @__PURE__ */ __name(function(expected2) {
              if (peg$silentFails === 0)
                peg$expect(expected2);
            }, "rule$expects");
            s0 = peg$currPos;
            s1 = peg$parseIdentifier();
            if (s1 !== peg$FAILED) {
              rule$expects(peg$e4);
              if (input.charCodeAt(peg$currPos) === 61) {
                s2 = peg$c3;
                peg$currPos++;
              } else {
                s2 = peg$FAILED;
              }
              if (s2 !== peg$FAILED) {
                s3 = peg$parseValue();
                if (s3 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s0 = peg$f12(s1, s3);
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
            return s0;
          }
          __name(peg$parseTagAttribute, "peg$parseTagAttribute");
          function peg$parseFunction() {
            var s0, s1, s2, s3, s4, s5, s6, s7;
            var rule$expects = /* @__PURE__ */ __name(function(expected2) {
              if (peg$silentFails === 0)
                peg$expect(expected2);
            }, "rule$expects");
            s0 = peg$currPos;
            s1 = peg$parseIdentifier();
            if (s1 !== peg$FAILED) {
              rule$expects(peg$e5);
              if (input.charCodeAt(peg$currPos) === 40) {
                s2 = peg$c4;
                peg$currPos++;
              } else {
                s2 = peg$FAILED;
              }
              if (s2 !== peg$FAILED) {
                s3 = [];
                s4 = peg$parse_();
                while (s4 !== peg$FAILED) {
                  s3.push(s4);
                  s4 = peg$parse_();
                }
                s4 = peg$currPos;
                s5 = peg$parseFunctionParameter();
                if (s5 === peg$FAILED) {
                  s5 = null;
                }
                s6 = [];
                s7 = peg$parseFunctionParameterTail();
                while (s7 !== peg$FAILED) {
                  s6.push(s7);
                  s7 = peg$parseFunctionParameterTail();
                }
                peg$savedPos = s4;
                s4 = peg$f13(s1, s5, s6);
                rule$expects(peg$e6);
                if (input.charCodeAt(peg$currPos) === 41) {
                  s5 = peg$c5;
                  peg$currPos++;
                } else {
                  s5 = peg$FAILED;
                }
                if (s5 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s0 = peg$f14(s1, s4);
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
            return s0;
          }
          __name(peg$parseFunction, "peg$parseFunction");
          function peg$parseFunctionParameter() {
            var s0, s1, s2, s3;
            var rule$expects = /* @__PURE__ */ __name(function(expected2) {
              if (peg$silentFails === 0)
                peg$expect(expected2);
            }, "rule$expects");
            s0 = peg$currPos;
            s1 = peg$currPos;
            s2 = peg$parseIdentifier();
            if (s2 !== peg$FAILED) {
              rule$expects(peg$e4);
              if (input.charCodeAt(peg$currPos) === 61) {
                s3 = peg$c3;
                peg$currPos++;
              } else {
                s3 = peg$FAILED;
              }
              if (s3 !== peg$FAILED) {
                peg$savedPos = s1;
                s1 = peg$f15(s2);
              } else {
                peg$currPos = s1;
                s1 = peg$FAILED;
              }
            } else {
              peg$currPos = s1;
              s1 = peg$FAILED;
            }
            if (s1 === peg$FAILED) {
              s1 = null;
            }
            s2 = peg$parseValue();
            if (s2 !== peg$FAILED) {
              peg$savedPos = s0;
              s0 = peg$f16(s1, s2);
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
            return s0;
          }
          __name(peg$parseFunctionParameter, "peg$parseFunctionParameter");
          function peg$parseFunctionParameterTail() {
            var s0, s1, s2, s3, s4;
            var rule$expects = /* @__PURE__ */ __name(function(expected2) {
              if (peg$silentFails === 0)
                peg$expect(expected2);
            }, "rule$expects");
            s0 = peg$currPos;
            s1 = [];
            s2 = peg$parse_();
            while (s2 !== peg$FAILED) {
              s1.push(s2);
              s2 = peg$parse_();
            }
            rule$expects(peg$e7);
            if (input.charCodeAt(peg$currPos) === 44) {
              s2 = peg$c6;
              peg$currPos++;
            } else {
              s2 = peg$FAILED;
            }
            if (s2 !== peg$FAILED) {
              s3 = [];
              s4 = peg$parse_();
              while (s4 !== peg$FAILED) {
                s3.push(s4);
                s4 = peg$parse_();
              }
              s4 = peg$parseFunctionParameter();
              if (s4 !== peg$FAILED) {
                peg$savedPos = s0;
                s0 = peg$f17(s4);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
            return s0;
          }
          __name(peg$parseFunctionParameterTail, "peg$parseFunctionParameterTail");
          function peg$parseTrailingComma() {
            var s0, s1, s2;
            var rule$expects = /* @__PURE__ */ __name(function(expected2) {
              if (peg$silentFails === 0)
                peg$expect(expected2);
            }, "rule$expects");
            s0 = peg$currPos;
            s1 = [];
            s2 = peg$parse_();
            while (s2 !== peg$FAILED) {
              s1.push(s2);
              s2 = peg$parse_();
            }
            rule$expects(peg$e7);
            if (input.charCodeAt(peg$currPos) === 44) {
              s2 = peg$c6;
              peg$currPos++;
            } else {
              s2 = peg$FAILED;
            }
            if (s2 !== peg$FAILED) {
              s1 = [s1, s2];
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
            if (s0 === peg$FAILED) {
              s0 = null;
            }
            return s0;
          }
          __name(peg$parseTrailingComma, "peg$parseTrailingComma");
          function peg$parseVariable() {
            var s0, s1, s2, s3, s4;
            var rule$expects = /* @__PURE__ */ __name(function(expected2) {
              if (peg$silentFails === 0)
                peg$expect(expected2);
            }, "rule$expects");
            rule$expects(peg$e8);
            peg$silentFails++;
            s0 = peg$currPos;
            if (peg$r0.test(input.charAt(peg$currPos))) {
              s1 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s1 = peg$FAILED;
            }
            if (s1 !== peg$FAILED) {
              s2 = peg$parseIdentifier();
              if (s2 !== peg$FAILED) {
                s3 = [];
                s4 = peg$parseVariableTail();
                while (s4 !== peg$FAILED) {
                  s3.push(s4);
                  s4 = peg$parseVariableTail();
                }
                peg$savedPos = s0;
                s0 = peg$f18(s1, s2, s3);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
            peg$silentFails--;
            return s0;
          }
          __name(peg$parseVariable, "peg$parseVariable");
          function peg$parseVariableTail() {
            var s0, s1, s2, s3;
            var rule$expects = /* @__PURE__ */ __name(function(expected2) {
              if (peg$silentFails === 0)
                peg$expect(expected2);
            }, "rule$expects");
            s0 = peg$currPos;
            if (input.charCodeAt(peg$currPos) === 46) {
              s1 = peg$c1;
              peg$currPos++;
            } else {
              s1 = peg$FAILED;
            }
            if (s1 !== peg$FAILED) {
              s2 = peg$parseIdentifier();
              if (s2 !== peg$FAILED) {
                peg$savedPos = s0;
                s0 = peg$f15(s2);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
            if (s0 === peg$FAILED) {
              s0 = peg$currPos;
              if (input.charCodeAt(peg$currPos) === 91) {
                s1 = peg$c7;
                peg$currPos++;
              } else {
                s1 = peg$FAILED;
              }
              if (s1 !== peg$FAILED) {
                s2 = peg$parseValueNumber();
                if (s2 === peg$FAILED) {
                  s2 = peg$parseValueString();
                }
                if (s2 !== peg$FAILED) {
                  if (input.charCodeAt(peg$currPos) === 93) {
                    s3 = peg$c8;
                    peg$currPos++;
                  } else {
                    s3 = peg$FAILED;
                  }
                  if (s3 !== peg$FAILED) {
                    peg$savedPos = s0;
                    s0 = peg$f17(s2);
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            }
            return s0;
          }
          __name(peg$parseVariableTail, "peg$parseVariableTail");
          function peg$parseValue() {
            var s0;
            var rule$expects = /* @__PURE__ */ __name(function(expected2) {
              if (peg$silentFails === 0)
                peg$expect(expected2);
            }, "rule$expects");
            s0 = peg$parseValueNull();
            if (s0 === peg$FAILED) {
              s0 = peg$parseValueBoolean();
              if (s0 === peg$FAILED) {
                s0 = peg$parseValueString();
                if (s0 === peg$FAILED) {
                  s0 = peg$parseValueNumber();
                  if (s0 === peg$FAILED) {
                    s0 = peg$parseValueArray();
                    if (s0 === peg$FAILED) {
                      s0 = peg$parseValueHash();
                      if (s0 === peg$FAILED) {
                        s0 = peg$parseFunction();
                        if (s0 === peg$FAILED) {
                          s0 = peg$parseVariable();
                        }
                      }
                    }
                  }
                }
              }
            }
            return s0;
          }
          __name(peg$parseValue, "peg$parseValue");
          function peg$parseValueNull() {
            var s0, s1;
            var rule$expects = /* @__PURE__ */ __name(function(expected2) {
              if (peg$silentFails === 0)
                peg$expect(expected2);
            }, "rule$expects");
            rule$expects(peg$e9);
            peg$silentFails++;
            s0 = peg$currPos;
            if (input.substr(peg$currPos, 4) === peg$c9) {
              s1 = peg$c9;
              peg$currPos += 4;
            } else {
              s1 = peg$FAILED;
            }
            if (s1 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$f19();
            }
            s0 = s1;
            peg$silentFails--;
            return s0;
          }
          __name(peg$parseValueNull, "peg$parseValueNull");
          function peg$parseValueBoolean() {
            var s0, s1;
            var rule$expects = /* @__PURE__ */ __name(function(expected2) {
              if (peg$silentFails === 0)
                peg$expect(expected2);
            }, "rule$expects");
            rule$expects(peg$e10);
            peg$silentFails++;
            s0 = peg$currPos;
            if (input.substr(peg$currPos, 4) === peg$c10) {
              s1 = peg$c10;
              peg$currPos += 4;
            } else {
              s1 = peg$FAILED;
            }
            if (s1 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$f20();
            }
            s0 = s1;
            if (s0 === peg$FAILED) {
              s0 = peg$currPos;
              if (input.substr(peg$currPos, 5) === peg$c11) {
                s1 = peg$c11;
                peg$currPos += 5;
              } else {
                s1 = peg$FAILED;
              }
              if (s1 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$f21();
              }
              s0 = s1;
            }
            peg$silentFails--;
            return s0;
          }
          __name(peg$parseValueBoolean, "peg$parseValueBoolean");
          function peg$parseValueArray() {
            var s0, s1, s2, s3, s4, s5, s6;
            var rule$expects = /* @__PURE__ */ __name(function(expected2) {
              if (peg$silentFails === 0)
                peg$expect(expected2);
            }, "rule$expects");
            s0 = peg$currPos;
            rule$expects(peg$e11);
            if (input.charCodeAt(peg$currPos) === 91) {
              s1 = peg$c7;
              peg$currPos++;
            } else {
              s1 = peg$FAILED;
            }
            if (s1 !== peg$FAILED) {
              s2 = [];
              s3 = peg$parse_();
              while (s3 !== peg$FAILED) {
                s2.push(s3);
                s3 = peg$parse_();
              }
              s3 = peg$currPos;
              s4 = peg$parseValue();
              if (s4 !== peg$FAILED) {
                s5 = [];
                s6 = peg$parseValueArrayTail();
                while (s6 !== peg$FAILED) {
                  s5.push(s6);
                  s6 = peg$parseValueArrayTail();
                }
                s6 = peg$parseTrailingComma();
                peg$savedPos = s3;
                s3 = peg$f22(s4, s5);
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
              if (s3 === peg$FAILED) {
                s3 = null;
              }
              s4 = [];
              s5 = peg$parse_();
              while (s5 !== peg$FAILED) {
                s4.push(s5);
                s5 = peg$parse_();
              }
              rule$expects(peg$e12);
              if (input.charCodeAt(peg$currPos) === 93) {
                s5 = peg$c8;
                peg$currPos++;
              } else {
                s5 = peg$FAILED;
              }
              if (s5 !== peg$FAILED) {
                peg$savedPos = s0;
                s0 = peg$f23(s3);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
            return s0;
          }
          __name(peg$parseValueArray, "peg$parseValueArray");
          function peg$parseValueArrayTail() {
            var s0, s1, s2, s3, s4;
            var rule$expects = /* @__PURE__ */ __name(function(expected2) {
              if (peg$silentFails === 0)
                peg$expect(expected2);
            }, "rule$expects");
            s0 = peg$currPos;
            s1 = [];
            s2 = peg$parse_();
            while (s2 !== peg$FAILED) {
              s1.push(s2);
              s2 = peg$parse_();
            }
            rule$expects(peg$e7);
            if (input.charCodeAt(peg$currPos) === 44) {
              s2 = peg$c6;
              peg$currPos++;
            } else {
              s2 = peg$FAILED;
            }
            if (s2 !== peg$FAILED) {
              s3 = [];
              s4 = peg$parse_();
              while (s4 !== peg$FAILED) {
                s3.push(s4);
                s4 = peg$parse_();
              }
              s4 = peg$parseValue();
              if (s4 !== peg$FAILED) {
                peg$savedPos = s0;
                s0 = peg$f17(s4);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
            return s0;
          }
          __name(peg$parseValueArrayTail, "peg$parseValueArrayTail");
          function peg$parseValueHash() {
            var s0, s1, s2, s3, s4, s5, s6;
            var rule$expects = /* @__PURE__ */ __name(function(expected2) {
              if (peg$silentFails === 0)
                peg$expect(expected2);
            }, "rule$expects");
            s0 = peg$currPos;
            rule$expects(peg$e13);
            if (input.charCodeAt(peg$currPos) === 123) {
              s1 = peg$c12;
              peg$currPos++;
            } else {
              s1 = peg$FAILED;
            }
            if (s1 !== peg$FAILED) {
              s2 = [];
              s3 = peg$parse_();
              while (s3 !== peg$FAILED) {
                s2.push(s3);
                s3 = peg$parse_();
              }
              s3 = peg$currPos;
              s4 = peg$parseValueHashItem();
              if (s4 !== peg$FAILED) {
                s5 = [];
                s6 = peg$parseValueHashTail();
                while (s6 !== peg$FAILED) {
                  s5.push(s6);
                  s6 = peg$parseValueHashTail();
                }
                s6 = peg$parseTrailingComma();
                peg$savedPos = s3;
                s3 = peg$f24(s4, s5);
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
              if (s3 === peg$FAILED) {
                s3 = null;
              }
              s4 = [];
              s5 = peg$parse_();
              while (s5 !== peg$FAILED) {
                s4.push(s5);
                s5 = peg$parse_();
              }
              rule$expects(peg$e14);
              if (input.charCodeAt(peg$currPos) === 125) {
                s5 = peg$c13;
                peg$currPos++;
              } else {
                s5 = peg$FAILED;
              }
              if (s5 !== peg$FAILED) {
                peg$savedPos = s0;
                s0 = peg$f25(s3);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
            return s0;
          }
          __name(peg$parseValueHash, "peg$parseValueHash");
          function peg$parseValueHashTail() {
            var s0, s1, s2, s3, s4;
            var rule$expects = /* @__PURE__ */ __name(function(expected2) {
              if (peg$silentFails === 0)
                peg$expect(expected2);
            }, "rule$expects");
            s0 = peg$currPos;
            s1 = [];
            s2 = peg$parse_();
            while (s2 !== peg$FAILED) {
              s1.push(s2);
              s2 = peg$parse_();
            }
            rule$expects(peg$e7);
            if (input.charCodeAt(peg$currPos) === 44) {
              s2 = peg$c6;
              peg$currPos++;
            } else {
              s2 = peg$FAILED;
            }
            if (s2 !== peg$FAILED) {
              s3 = [];
              s4 = peg$parse_();
              while (s4 !== peg$FAILED) {
                s3.push(s4);
                s4 = peg$parse_();
              }
              s4 = peg$parseValueHashItem();
              if (s4 !== peg$FAILED) {
                peg$savedPos = s0;
                s0 = peg$f6(s4);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
            return s0;
          }
          __name(peg$parseValueHashTail, "peg$parseValueHashTail");
          function peg$parseValueHashItem() {
            var s0, s1, s2, s3, s4;
            var rule$expects = /* @__PURE__ */ __name(function(expected2) {
              if (peg$silentFails === 0)
                peg$expect(expected2);
            }, "rule$expects");
            s0 = peg$currPos;
            s1 = peg$parseIdentifier();
            if (s1 === peg$FAILED) {
              s1 = peg$parseValueString();
            }
            if (s1 !== peg$FAILED) {
              rule$expects(peg$e15);
              if (input.charCodeAt(peg$currPos) === 58) {
                s2 = peg$c14;
                peg$currPos++;
              } else {
                s2 = peg$FAILED;
              }
              if (s2 !== peg$FAILED) {
                s3 = [];
                s4 = peg$parse_();
                while (s4 !== peg$FAILED) {
                  s3.push(s4);
                  s4 = peg$parse_();
                }
                s4 = peg$parseValue();
                if (s4 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s0 = peg$f26(s1, s4);
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
            return s0;
          }
          __name(peg$parseValueHashItem, "peg$parseValueHashItem");
          function peg$parseValueNumber() {
            var s0, s1, s2, s3, s4, s5, s6;
            var rule$expects = /* @__PURE__ */ __name(function(expected2) {
              if (peg$silentFails === 0)
                peg$expect(expected2);
            }, "rule$expects");
            rule$expects(peg$e16);
            peg$silentFails++;
            s0 = peg$currPos;
            if (input.charCodeAt(peg$currPos) === 45) {
              s1 = peg$c15;
              peg$currPos++;
            } else {
              s1 = peg$FAILED;
            }
            if (s1 === peg$FAILED) {
              s1 = null;
            }
            s2 = [];
            if (peg$r1.test(input.charAt(peg$currPos))) {
              s3 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
            }
            if (s3 !== peg$FAILED) {
              while (s3 !== peg$FAILED) {
                s2.push(s3);
                if (peg$r1.test(input.charAt(peg$currPos))) {
                  s3 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s3 = peg$FAILED;
                }
              }
            } else {
              s2 = peg$FAILED;
            }
            if (s2 !== peg$FAILED) {
              s3 = peg$currPos;
              if (input.charCodeAt(peg$currPos) === 46) {
                s4 = peg$c1;
                peg$currPos++;
              } else {
                s4 = peg$FAILED;
              }
              if (s4 !== peg$FAILED) {
                s5 = [];
                if (peg$r1.test(input.charAt(peg$currPos))) {
                  s6 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s6 = peg$FAILED;
                }
                if (s6 !== peg$FAILED) {
                  while (s6 !== peg$FAILED) {
                    s5.push(s6);
                    if (peg$r1.test(input.charAt(peg$currPos))) {
                      s6 = input.charAt(peg$currPos);
                      peg$currPos++;
                    } else {
                      s6 = peg$FAILED;
                    }
                  }
                } else {
                  s5 = peg$FAILED;
                }
                if (s5 !== peg$FAILED) {
                  s4 = [s4, s5];
                  s3 = s4;
                } else {
                  peg$currPos = s3;
                  s3 = peg$FAILED;
                }
              } else {
                peg$currPos = s3;
                s3 = peg$FAILED;
              }
              if (s3 === peg$FAILED) {
                s3 = null;
              }
              peg$savedPos = s0;
              s0 = peg$f27();
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
            peg$silentFails--;
            return s0;
          }
          __name(peg$parseValueNumber, "peg$parseValueNumber");
          function peg$parseValueString() {
            var s0, s1, s2, s3;
            var rule$expects = /* @__PURE__ */ __name(function(expected2) {
              if (peg$silentFails === 0)
                peg$expect(expected2);
            }, "rule$expects");
            rule$expects(peg$e17);
            peg$silentFails++;
            s0 = peg$currPos;
            if (input.charCodeAt(peg$currPos) === 34) {
              s1 = peg$c16;
              peg$currPos++;
            } else {
              s1 = peg$FAILED;
            }
            if (s1 !== peg$FAILED) {
              s2 = [];
              s3 = peg$parseValueStringChars();
              while (s3 !== peg$FAILED) {
                s2.push(s3);
                s3 = peg$parseValueStringChars();
              }
              if (input.charCodeAt(peg$currPos) === 34) {
                s3 = peg$c16;
                peg$currPos++;
              } else {
                s3 = peg$FAILED;
              }
              if (s3 !== peg$FAILED) {
                peg$savedPos = s0;
                s0 = peg$f28(s2);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
            peg$silentFails--;
            return s0;
          }
          __name(peg$parseValueString, "peg$parseValueString");
          function peg$parseValueStringChars() {
            var s0;
            var rule$expects = /* @__PURE__ */ __name(function(expected2) {
              if (peg$silentFails === 0)
                peg$expect(expected2);
            }, "rule$expects");
            if (peg$r2.test(input.charAt(peg$currPos))) {
              s0 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s0 = peg$FAILED;
            }
            if (s0 === peg$FAILED) {
              s0 = peg$parseValueStringEscapes();
            }
            return s0;
          }
          __name(peg$parseValueStringChars, "peg$parseValueStringChars");
          function peg$parseValueStringEscapes() {
            var s0, s1, s2, s3;
            var rule$expects = /* @__PURE__ */ __name(function(expected2) {
              if (peg$silentFails === 0)
                peg$expect(expected2);
            }, "rule$expects");
            s0 = peg$currPos;
            if (input.charCodeAt(peg$currPos) === 92) {
              s1 = peg$c17;
              peg$currPos++;
            } else {
              s1 = peg$FAILED;
            }
            if (s1 !== peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 34) {
                s2 = peg$c16;
                peg$currPos++;
              } else {
                s2 = peg$FAILED;
              }
              if (s2 === peg$FAILED) {
                if (input.charCodeAt(peg$currPos) === 92) {
                  s2 = peg$c17;
                  peg$currPos++;
                } else {
                  s2 = peg$FAILED;
                }
                if (s2 === peg$FAILED) {
                  s2 = peg$currPos;
                  if (input.charCodeAt(peg$currPos) === 110) {
                    s3 = peg$c18;
                    peg$currPos++;
                  } else {
                    s3 = peg$FAILED;
                  }
                  if (s3 !== peg$FAILED) {
                    peg$savedPos = s2;
                    s3 = peg$f29();
                  }
                  s2 = s3;
                  if (s2 === peg$FAILED) {
                    s2 = peg$currPos;
                    if (input.charCodeAt(peg$currPos) === 114) {
                      s3 = peg$c19;
                      peg$currPos++;
                    } else {
                      s3 = peg$FAILED;
                    }
                    if (s3 !== peg$FAILED) {
                      peg$savedPos = s2;
                      s3 = peg$f30();
                    }
                    s2 = s3;
                    if (s2 === peg$FAILED) {
                      s2 = peg$currPos;
                      if (input.charCodeAt(peg$currPos) === 116) {
                        s3 = peg$c20;
                        peg$currPos++;
                      } else {
                        s3 = peg$FAILED;
                      }
                      if (s3 !== peg$FAILED) {
                        peg$savedPos = s2;
                        s3 = peg$f31();
                      }
                      s2 = s3;
                    }
                  }
                }
              }
              if (s2 !== peg$FAILED) {
                peg$savedPos = s0;
                s0 = peg$f32(s2);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
            return s0;
          }
          __name(peg$parseValueStringEscapes, "peg$parseValueStringEscapes");
          function peg$parseIdentifier() {
            var s0, s1, s2;
            var rule$expects = /* @__PURE__ */ __name(function(expected2) {
              if (peg$silentFails === 0)
                peg$expect(expected2);
            }, "rule$expects");
            rule$expects(peg$e18);
            peg$silentFails++;
            s0 = peg$currPos;
            s1 = [];
            if (peg$r3.test(input.charAt(peg$currPos))) {
              s2 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s2 = peg$FAILED;
            }
            if (s2 !== peg$FAILED) {
              while (s2 !== peg$FAILED) {
                s1.push(s2);
                if (peg$r3.test(input.charAt(peg$currPos))) {
                  s2 = input.charAt(peg$currPos);
                  peg$currPos++;
                } else {
                  s2 = peg$FAILED;
                }
              }
            } else {
              s1 = peg$FAILED;
            }
            if (s1 !== peg$FAILED) {
              s0 = input.substring(s0, peg$currPos);
            } else {
              s0 = s1;
            }
            peg$silentFails--;
            return s0;
          }
          __name(peg$parseIdentifier, "peg$parseIdentifier");
          function peg$parse_() {
            var s0;
            var rule$expects = /* @__PURE__ */ __name(function(expected2) {
              if (peg$silentFails === 0)
                peg$expect(expected2);
            }, "rule$expects");
            rule$expects(peg$e19);
            peg$silentFails++;
            if (peg$r4.test(input.charAt(peg$currPos))) {
              s0 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s0 = peg$FAILED;
            }
            peg$silentFails--;
            return s0;
          }
          __name(peg$parse_, "peg$parse_");
          const { Variable: Variable2, Function: Function3 } = options;
          peg$begin();
          peg$result = peg$startRuleFunction();
          if (peg$result !== peg$FAILED && peg$currPos === input.length) {
            return peg$result;
          } else {
            if (peg$result !== peg$FAILED && peg$currPos < input.length) {
              peg$expect(peg$endExpectation());
            }
            throw peg$buildError();
          }
        }
        __name(peg$parse, "peg$parse");
        module.exports = {
          SyntaxError: peg$SyntaxError,
          parse: peg$parse
        };
      }
    });
    require_entities = __commonJS2({
      "node_modules/entities/lib/maps/entities.json"(exports, module) {
        module.exports = { Aacute: "\xC1", aacute: "\xE1", Abreve: "\u0102", abreve: "\u0103", ac: "\u223E", acd: "\u223F", acE: "\u223E\u0333", Acirc: "\xC2", acirc: "\xE2", acute: "\xB4", Acy: "\u0410", acy: "\u0430", AElig: "\xC6", aelig: "\xE6", af: "\u2061", Afr: "\u{1D504}", afr: "\u{1D51E}", Agrave: "\xC0", agrave: "\xE0", alefsym: "\u2135", aleph: "\u2135", Alpha: "\u0391", alpha: "\u03B1", Amacr: "\u0100", amacr: "\u0101", amalg: "\u2A3F", amp: "&", AMP: "&", andand: "\u2A55", And: "\u2A53", and: "\u2227", andd: "\u2A5C", andslope: "\u2A58", andv: "\u2A5A", ang: "\u2220", ange: "\u29A4", angle: "\u2220", angmsdaa: "\u29A8", angmsdab: "\u29A9", angmsdac: "\u29AA", angmsdad: "\u29AB", angmsdae: "\u29AC", angmsdaf: "\u29AD", angmsdag: "\u29AE", angmsdah: "\u29AF", angmsd: "\u2221", angrt: "\u221F", angrtvb: "\u22BE", angrtvbd: "\u299D", angsph: "\u2222", angst: "\xC5", angzarr: "\u237C", Aogon: "\u0104", aogon: "\u0105", Aopf: "\u{1D538}", aopf: "\u{1D552}", apacir: "\u2A6F", ap: "\u2248", apE: "\u2A70", ape: "\u224A", apid: "\u224B", apos: "'", ApplyFunction: "\u2061", approx: "\u2248", approxeq: "\u224A", Aring: "\xC5", aring: "\xE5", Ascr: "\u{1D49C}", ascr: "\u{1D4B6}", Assign: "\u2254", ast: "*", asymp: "\u2248", asympeq: "\u224D", Atilde: "\xC3", atilde: "\xE3", Auml: "\xC4", auml: "\xE4", awconint: "\u2233", awint: "\u2A11", backcong: "\u224C", backepsilon: "\u03F6", backprime: "\u2035", backsim: "\u223D", backsimeq: "\u22CD", Backslash: "\u2216", Barv: "\u2AE7", barvee: "\u22BD", barwed: "\u2305", Barwed: "\u2306", barwedge: "\u2305", bbrk: "\u23B5", bbrktbrk: "\u23B6", bcong: "\u224C", Bcy: "\u0411", bcy: "\u0431", bdquo: "\u201E", becaus: "\u2235", because: "\u2235", Because: "\u2235", bemptyv: "\u29B0", bepsi: "\u03F6", bernou: "\u212C", Bernoullis: "\u212C", Beta: "\u0392", beta: "\u03B2", beth: "\u2136", between: "\u226C", Bfr: "\u{1D505}", bfr: "\u{1D51F}", bigcap: "\u22C2", bigcirc: "\u25EF", bigcup: "\u22C3", bigodot: "\u2A00", bigoplus: "\u2A01", bigotimes: "\u2A02", bigsqcup: "\u2A06", bigstar: "\u2605", bigtriangledown: "\u25BD", bigtriangleup: "\u25B3", biguplus: "\u2A04", bigvee: "\u22C1", bigwedge: "\u22C0", bkarow: "\u290D", blacklozenge: "\u29EB", blacksquare: "\u25AA", blacktriangle: "\u25B4", blacktriangledown: "\u25BE", blacktriangleleft: "\u25C2", blacktriangleright: "\u25B8", blank: "\u2423", blk12: "\u2592", blk14: "\u2591", blk34: "\u2593", block: "\u2588", bne: "=\u20E5", bnequiv: "\u2261\u20E5", bNot: "\u2AED", bnot: "\u2310", Bopf: "\u{1D539}", bopf: "\u{1D553}", bot: "\u22A5", bottom: "\u22A5", bowtie: "\u22C8", boxbox: "\u29C9", boxdl: "\u2510", boxdL: "\u2555", boxDl: "\u2556", boxDL: "\u2557", boxdr: "\u250C", boxdR: "\u2552", boxDr: "\u2553", boxDR: "\u2554", boxh: "\u2500", boxH: "\u2550", boxhd: "\u252C", boxHd: "\u2564", boxhD: "\u2565", boxHD: "\u2566", boxhu: "\u2534", boxHu: "\u2567", boxhU: "\u2568", boxHU: "\u2569", boxminus: "\u229F", boxplus: "\u229E", boxtimes: "\u22A0", boxul: "\u2518", boxuL: "\u255B", boxUl: "\u255C", boxUL: "\u255D", boxur: "\u2514", boxuR: "\u2558", boxUr: "\u2559", boxUR: "\u255A", boxv: "\u2502", boxV: "\u2551", boxvh: "\u253C", boxvH: "\u256A", boxVh: "\u256B", boxVH: "\u256C", boxvl: "\u2524", boxvL: "\u2561", boxVl: "\u2562", boxVL: "\u2563", boxvr: "\u251C", boxvR: "\u255E", boxVr: "\u255F", boxVR: "\u2560", bprime: "\u2035", breve: "\u02D8", Breve: "\u02D8", brvbar: "\xA6", bscr: "\u{1D4B7}", Bscr: "\u212C", bsemi: "\u204F", bsim: "\u223D", bsime: "\u22CD", bsolb: "\u29C5", bsol: "\\", bsolhsub: "\u27C8", bull: "\u2022", bullet: "\u2022", bump: "\u224E", bumpE: "\u2AAE", bumpe: "\u224F", Bumpeq: "\u224E", bumpeq: "\u224F", Cacute: "\u0106", cacute: "\u0107", capand: "\u2A44", capbrcup: "\u2A49", capcap: "\u2A4B", cap: "\u2229", Cap: "\u22D2", capcup: "\u2A47", capdot: "\u2A40", CapitalDifferentialD: "\u2145", caps: "\u2229\uFE00", caret: "\u2041", caron: "\u02C7", Cayleys: "\u212D", ccaps: "\u2A4D", Ccaron: "\u010C", ccaron: "\u010D", Ccedil: "\xC7", ccedil: "\xE7", Ccirc: "\u0108", ccirc: "\u0109", Cconint: "\u2230", ccups: "\u2A4C", ccupssm: "\u2A50", Cdot: "\u010A", cdot: "\u010B", cedil: "\xB8", Cedilla: "\xB8", cemptyv: "\u29B2", cent: "\xA2", centerdot: "\xB7", CenterDot: "\xB7", cfr: "\u{1D520}", Cfr: "\u212D", CHcy: "\u0427", chcy: "\u0447", check: "\u2713", checkmark: "\u2713", Chi: "\u03A7", chi: "\u03C7", circ: "\u02C6", circeq: "\u2257", circlearrowleft: "\u21BA", circlearrowright: "\u21BB", circledast: "\u229B", circledcirc: "\u229A", circleddash: "\u229D", CircleDot: "\u2299", circledR: "\xAE", circledS: "\u24C8", CircleMinus: "\u2296", CirclePlus: "\u2295", CircleTimes: "\u2297", cir: "\u25CB", cirE: "\u29C3", cire: "\u2257", cirfnint: "\u2A10", cirmid: "\u2AEF", cirscir: "\u29C2", ClockwiseContourIntegral: "\u2232", CloseCurlyDoubleQuote: "\u201D", CloseCurlyQuote: "\u2019", clubs: "\u2663", clubsuit: "\u2663", colon: ":", Colon: "\u2237", Colone: "\u2A74", colone: "\u2254", coloneq: "\u2254", comma: ",", commat: "@", comp: "\u2201", compfn: "\u2218", complement: "\u2201", complexes: "\u2102", cong: "\u2245", congdot: "\u2A6D", Congruent: "\u2261", conint: "\u222E", Conint: "\u222F", ContourIntegral: "\u222E", copf: "\u{1D554}", Copf: "\u2102", coprod: "\u2210", Coproduct: "\u2210", copy: "\xA9", COPY: "\xA9", copysr: "\u2117", CounterClockwiseContourIntegral: "\u2233", crarr: "\u21B5", cross: "\u2717", Cross: "\u2A2F", Cscr: "\u{1D49E}", cscr: "\u{1D4B8}", csub: "\u2ACF", csube: "\u2AD1", csup: "\u2AD0", csupe: "\u2AD2", ctdot: "\u22EF", cudarrl: "\u2938", cudarrr: "\u2935", cuepr: "\u22DE", cuesc: "\u22DF", cularr: "\u21B6", cularrp: "\u293D", cupbrcap: "\u2A48", cupcap: "\u2A46", CupCap: "\u224D", cup: "\u222A", Cup: "\u22D3", cupcup: "\u2A4A", cupdot: "\u228D", cupor: "\u2A45", cups: "\u222A\uFE00", curarr: "\u21B7", curarrm: "\u293C", curlyeqprec: "\u22DE", curlyeqsucc: "\u22DF", curlyvee: "\u22CE", curlywedge: "\u22CF", curren: "\xA4", curvearrowleft: "\u21B6", curvearrowright: "\u21B7", cuvee: "\u22CE", cuwed: "\u22CF", cwconint: "\u2232", cwint: "\u2231", cylcty: "\u232D", dagger: "\u2020", Dagger: "\u2021", daleth: "\u2138", darr: "\u2193", Darr: "\u21A1", dArr: "\u21D3", dash: "\u2010", Dashv: "\u2AE4", dashv: "\u22A3", dbkarow: "\u290F", dblac: "\u02DD", Dcaron: "\u010E", dcaron: "\u010F", Dcy: "\u0414", dcy: "\u0434", ddagger: "\u2021", ddarr: "\u21CA", DD: "\u2145", dd: "\u2146", DDotrahd: "\u2911", ddotseq: "\u2A77", deg: "\xB0", Del: "\u2207", Delta: "\u0394", delta: "\u03B4", demptyv: "\u29B1", dfisht: "\u297F", Dfr: "\u{1D507}", dfr: "\u{1D521}", dHar: "\u2965", dharl: "\u21C3", dharr: "\u21C2", DiacriticalAcute: "\xB4", DiacriticalDot: "\u02D9", DiacriticalDoubleAcute: "\u02DD", DiacriticalGrave: "`", DiacriticalTilde: "\u02DC", diam: "\u22C4", diamond: "\u22C4", Diamond: "\u22C4", diamondsuit: "\u2666", diams: "\u2666", die: "\xA8", DifferentialD: "\u2146", digamma: "\u03DD", disin: "\u22F2", div: "\xF7", divide: "\xF7", divideontimes: "\u22C7", divonx: "\u22C7", DJcy: "\u0402", djcy: "\u0452", dlcorn: "\u231E", dlcrop: "\u230D", dollar: "$", Dopf: "\u{1D53B}", dopf: "\u{1D555}", Dot: "\xA8", dot: "\u02D9", DotDot: "\u20DC", doteq: "\u2250", doteqdot: "\u2251", DotEqual: "\u2250", dotminus: "\u2238", dotplus: "\u2214", dotsquare: "\u22A1", doublebarwedge: "\u2306", DoubleContourIntegral: "\u222F", DoubleDot: "\xA8", DoubleDownArrow: "\u21D3", DoubleLeftArrow: "\u21D0", DoubleLeftRightArrow: "\u21D4", DoubleLeftTee: "\u2AE4", DoubleLongLeftArrow: "\u27F8", DoubleLongLeftRightArrow: "\u27FA", DoubleLongRightArrow: "\u27F9", DoubleRightArrow: "\u21D2", DoubleRightTee: "\u22A8", DoubleUpArrow: "\u21D1", DoubleUpDownArrow: "\u21D5", DoubleVerticalBar: "\u2225", DownArrowBar: "\u2913", downarrow: "\u2193", DownArrow: "\u2193", Downarrow: "\u21D3", DownArrowUpArrow: "\u21F5", DownBreve: "\u0311", downdownarrows: "\u21CA", downharpoonleft: "\u21C3", downharpoonright: "\u21C2", DownLeftRightVector: "\u2950", DownLeftTeeVector: "\u295E", DownLeftVectorBar: "\u2956", DownLeftVector: "\u21BD", DownRightTeeVector: "\u295F", DownRightVectorBar: "\u2957", DownRightVector: "\u21C1", DownTeeArrow: "\u21A7", DownTee: "\u22A4", drbkarow: "\u2910", drcorn: "\u231F", drcrop: "\u230C", Dscr: "\u{1D49F}", dscr: "\u{1D4B9}", DScy: "\u0405", dscy: "\u0455", dsol: "\u29F6", Dstrok: "\u0110", dstrok: "\u0111", dtdot: "\u22F1", dtri: "\u25BF", dtrif: "\u25BE", duarr: "\u21F5", duhar: "\u296F", dwangle: "\u29A6", DZcy: "\u040F", dzcy: "\u045F", dzigrarr: "\u27FF", Eacute: "\xC9", eacute: "\xE9", easter: "\u2A6E", Ecaron: "\u011A", ecaron: "\u011B", Ecirc: "\xCA", ecirc: "\xEA", ecir: "\u2256", ecolon: "\u2255", Ecy: "\u042D", ecy: "\u044D", eDDot: "\u2A77", Edot: "\u0116", edot: "\u0117", eDot: "\u2251", ee: "\u2147", efDot: "\u2252", Efr: "\u{1D508}", efr: "\u{1D522}", eg: "\u2A9A", Egrave: "\xC8", egrave: "\xE8", egs: "\u2A96", egsdot: "\u2A98", el: "\u2A99", Element: "\u2208", elinters: "\u23E7", ell: "\u2113", els: "\u2A95", elsdot: "\u2A97", Emacr: "\u0112", emacr: "\u0113", empty: "\u2205", emptyset: "\u2205", EmptySmallSquare: "\u25FB", emptyv: "\u2205", EmptyVerySmallSquare: "\u25AB", emsp13: "\u2004", emsp14: "\u2005", emsp: "\u2003", ENG: "\u014A", eng: "\u014B", ensp: "\u2002", Eogon: "\u0118", eogon: "\u0119", Eopf: "\u{1D53C}", eopf: "\u{1D556}", epar: "\u22D5", eparsl: "\u29E3", eplus: "\u2A71", epsi: "\u03B5", Epsilon: "\u0395", epsilon: "\u03B5", epsiv: "\u03F5", eqcirc: "\u2256", eqcolon: "\u2255", eqsim: "\u2242", eqslantgtr: "\u2A96", eqslantless: "\u2A95", Equal: "\u2A75", equals: "=", EqualTilde: "\u2242", equest: "\u225F", Equilibrium: "\u21CC", equiv: "\u2261", equivDD: "\u2A78", eqvparsl: "\u29E5", erarr: "\u2971", erDot: "\u2253", escr: "\u212F", Escr: "\u2130", esdot: "\u2250", Esim: "\u2A73", esim: "\u2242", Eta: "\u0397", eta: "\u03B7", ETH: "\xD0", eth: "\xF0", Euml: "\xCB", euml: "\xEB", euro: "\u20AC", excl: "!", exist: "\u2203", Exists: "\u2203", expectation: "\u2130", exponentiale: "\u2147", ExponentialE: "\u2147", fallingdotseq: "\u2252", Fcy: "\u0424", fcy: "\u0444", female: "\u2640", ffilig: "\uFB03", fflig: "\uFB00", ffllig: "\uFB04", Ffr: "\u{1D509}", ffr: "\u{1D523}", filig: "\uFB01", FilledSmallSquare: "\u25FC", FilledVerySmallSquare: "\u25AA", fjlig: "fj", flat: "\u266D", fllig: "\uFB02", fltns: "\u25B1", fnof: "\u0192", Fopf: "\u{1D53D}", fopf: "\u{1D557}", forall: "\u2200", ForAll: "\u2200", fork: "\u22D4", forkv: "\u2AD9", Fouriertrf: "\u2131", fpartint: "\u2A0D", frac12: "\xBD", frac13: "\u2153", frac14: "\xBC", frac15: "\u2155", frac16: "\u2159", frac18: "\u215B", frac23: "\u2154", frac25: "\u2156", frac34: "\xBE", frac35: "\u2157", frac38: "\u215C", frac45: "\u2158", frac56: "\u215A", frac58: "\u215D", frac78: "\u215E", frasl: "\u2044", frown: "\u2322", fscr: "\u{1D4BB}", Fscr: "\u2131", gacute: "\u01F5", Gamma: "\u0393", gamma: "\u03B3", Gammad: "\u03DC", gammad: "\u03DD", gap: "\u2A86", Gbreve: "\u011E", gbreve: "\u011F", Gcedil: "\u0122", Gcirc: "\u011C", gcirc: "\u011D", Gcy: "\u0413", gcy: "\u0433", Gdot: "\u0120", gdot: "\u0121", ge: "\u2265", gE: "\u2267", gEl: "\u2A8C", gel: "\u22DB", geq: "\u2265", geqq: "\u2267", geqslant: "\u2A7E", gescc: "\u2AA9", ges: "\u2A7E", gesdot: "\u2A80", gesdoto: "\u2A82", gesdotol: "\u2A84", gesl: "\u22DB\uFE00", gesles: "\u2A94", Gfr: "\u{1D50A}", gfr: "\u{1D524}", gg: "\u226B", Gg: "\u22D9", ggg: "\u22D9", gimel: "\u2137", GJcy: "\u0403", gjcy: "\u0453", gla: "\u2AA5", gl: "\u2277", glE: "\u2A92", glj: "\u2AA4", gnap: "\u2A8A", gnapprox: "\u2A8A", gne: "\u2A88", gnE: "\u2269", gneq: "\u2A88", gneqq: "\u2269", gnsim: "\u22E7", Gopf: "\u{1D53E}", gopf: "\u{1D558}", grave: "`", GreaterEqual: "\u2265", GreaterEqualLess: "\u22DB", GreaterFullEqual: "\u2267", GreaterGreater: "\u2AA2", GreaterLess: "\u2277", GreaterSlantEqual: "\u2A7E", GreaterTilde: "\u2273", Gscr: "\u{1D4A2}", gscr: "\u210A", gsim: "\u2273", gsime: "\u2A8E", gsiml: "\u2A90", gtcc: "\u2AA7", gtcir: "\u2A7A", gt: ">", GT: ">", Gt: "\u226B", gtdot: "\u22D7", gtlPar: "\u2995", gtquest: "\u2A7C", gtrapprox: "\u2A86", gtrarr: "\u2978", gtrdot: "\u22D7", gtreqless: "\u22DB", gtreqqless: "\u2A8C", gtrless: "\u2277", gtrsim: "\u2273", gvertneqq: "\u2269\uFE00", gvnE: "\u2269\uFE00", Hacek: "\u02C7", hairsp: "\u200A", half: "\xBD", hamilt: "\u210B", HARDcy: "\u042A", hardcy: "\u044A", harrcir: "\u2948", harr: "\u2194", hArr: "\u21D4", harrw: "\u21AD", Hat: "^", hbar: "\u210F", Hcirc: "\u0124", hcirc: "\u0125", hearts: "\u2665", heartsuit: "\u2665", hellip: "\u2026", hercon: "\u22B9", hfr: "\u{1D525}", Hfr: "\u210C", HilbertSpace: "\u210B", hksearow: "\u2925", hkswarow: "\u2926", hoarr: "\u21FF", homtht: "\u223B", hookleftarrow: "\u21A9", hookrightarrow: "\u21AA", hopf: "\u{1D559}", Hopf: "\u210D", horbar: "\u2015", HorizontalLine: "\u2500", hscr: "\u{1D4BD}", Hscr: "\u210B", hslash: "\u210F", Hstrok: "\u0126", hstrok: "\u0127", HumpDownHump: "\u224E", HumpEqual: "\u224F", hybull: "\u2043", hyphen: "\u2010", Iacute: "\xCD", iacute: "\xED", ic: "\u2063", Icirc: "\xCE", icirc: "\xEE", Icy: "\u0418", icy: "\u0438", Idot: "\u0130", IEcy: "\u0415", iecy: "\u0435", iexcl: "\xA1", iff: "\u21D4", ifr: "\u{1D526}", Ifr: "\u2111", Igrave: "\xCC", igrave: "\xEC", ii: "\u2148", iiiint: "\u2A0C", iiint: "\u222D", iinfin: "\u29DC", iiota: "\u2129", IJlig: "\u0132", ijlig: "\u0133", Imacr: "\u012A", imacr: "\u012B", image: "\u2111", ImaginaryI: "\u2148", imagline: "\u2110", imagpart: "\u2111", imath: "\u0131", Im: "\u2111", imof: "\u22B7", imped: "\u01B5", Implies: "\u21D2", incare: "\u2105", in: "\u2208", infin: "\u221E", infintie: "\u29DD", inodot: "\u0131", intcal: "\u22BA", int: "\u222B", Int: "\u222C", integers: "\u2124", Integral: "\u222B", intercal: "\u22BA", Intersection: "\u22C2", intlarhk: "\u2A17", intprod: "\u2A3C", InvisibleComma: "\u2063", InvisibleTimes: "\u2062", IOcy: "\u0401", iocy: "\u0451", Iogon: "\u012E", iogon: "\u012F", Iopf: "\u{1D540}", iopf: "\u{1D55A}", Iota: "\u0399", iota: "\u03B9", iprod: "\u2A3C", iquest: "\xBF", iscr: "\u{1D4BE}", Iscr: "\u2110", isin: "\u2208", isindot: "\u22F5", isinE: "\u22F9", isins: "\u22F4", isinsv: "\u22F3", isinv: "\u2208", it: "\u2062", Itilde: "\u0128", itilde: "\u0129", Iukcy: "\u0406", iukcy: "\u0456", Iuml: "\xCF", iuml: "\xEF", Jcirc: "\u0134", jcirc: "\u0135", Jcy: "\u0419", jcy: "\u0439", Jfr: "\u{1D50D}", jfr: "\u{1D527}", jmath: "\u0237", Jopf: "\u{1D541}", jopf: "\u{1D55B}", Jscr: "\u{1D4A5}", jscr: "\u{1D4BF}", Jsercy: "\u0408", jsercy: "\u0458", Jukcy: "\u0404", jukcy: "\u0454", Kappa: "\u039A", kappa: "\u03BA", kappav: "\u03F0", Kcedil: "\u0136", kcedil: "\u0137", Kcy: "\u041A", kcy: "\u043A", Kfr: "\u{1D50E}", kfr: "\u{1D528}", kgreen: "\u0138", KHcy: "\u0425", khcy: "\u0445", KJcy: "\u040C", kjcy: "\u045C", Kopf: "\u{1D542}", kopf: "\u{1D55C}", Kscr: "\u{1D4A6}", kscr: "\u{1D4C0}", lAarr: "\u21DA", Lacute: "\u0139", lacute: "\u013A", laemptyv: "\u29B4", lagran: "\u2112", Lambda: "\u039B", lambda: "\u03BB", lang: "\u27E8", Lang: "\u27EA", langd: "\u2991", langle: "\u27E8", lap: "\u2A85", Laplacetrf: "\u2112", laquo: "\xAB", larrb: "\u21E4", larrbfs: "\u291F", larr: "\u2190", Larr: "\u219E", lArr: "\u21D0", larrfs: "\u291D", larrhk: "\u21A9", larrlp: "\u21AB", larrpl: "\u2939", larrsim: "\u2973", larrtl: "\u21A2", latail: "\u2919", lAtail: "\u291B", lat: "\u2AAB", late: "\u2AAD", lates: "\u2AAD\uFE00", lbarr: "\u290C", lBarr: "\u290E", lbbrk: "\u2772", lbrace: "{", lbrack: "[", lbrke: "\u298B", lbrksld: "\u298F", lbrkslu: "\u298D", Lcaron: "\u013D", lcaron: "\u013E", Lcedil: "\u013B", lcedil: "\u013C", lceil: "\u2308", lcub: "{", Lcy: "\u041B", lcy: "\u043B", ldca: "\u2936", ldquo: "\u201C", ldquor: "\u201E", ldrdhar: "\u2967", ldrushar: "\u294B", ldsh: "\u21B2", le: "\u2264", lE: "\u2266", LeftAngleBracket: "\u27E8", LeftArrowBar: "\u21E4", leftarrow: "\u2190", LeftArrow: "\u2190", Leftarrow: "\u21D0", LeftArrowRightArrow: "\u21C6", leftarrowtail: "\u21A2", LeftCeiling: "\u2308", LeftDoubleBracket: "\u27E6", LeftDownTeeVector: "\u2961", LeftDownVectorBar: "\u2959", LeftDownVector: "\u21C3", LeftFloor: "\u230A", leftharpoondown: "\u21BD", leftharpoonup: "\u21BC", leftleftarrows: "\u21C7", leftrightarrow: "\u2194", LeftRightArrow: "\u2194", Leftrightarrow: "\u21D4", leftrightarrows: "\u21C6", leftrightharpoons: "\u21CB", leftrightsquigarrow: "\u21AD", LeftRightVector: "\u294E", LeftTeeArrow: "\u21A4", LeftTee: "\u22A3", LeftTeeVector: "\u295A", leftthreetimes: "\u22CB", LeftTriangleBar: "\u29CF", LeftTriangle: "\u22B2", LeftTriangleEqual: "\u22B4", LeftUpDownVector: "\u2951", LeftUpTeeVector: "\u2960", LeftUpVectorBar: "\u2958", LeftUpVector: "\u21BF", LeftVectorBar: "\u2952", LeftVector: "\u21BC", lEg: "\u2A8B", leg: "\u22DA", leq: "\u2264", leqq: "\u2266", leqslant: "\u2A7D", lescc: "\u2AA8", les: "\u2A7D", lesdot: "\u2A7F", lesdoto: "\u2A81", lesdotor: "\u2A83", lesg: "\u22DA\uFE00", lesges: "\u2A93", lessapprox: "\u2A85", lessdot: "\u22D6", lesseqgtr: "\u22DA", lesseqqgtr: "\u2A8B", LessEqualGreater: "\u22DA", LessFullEqual: "\u2266", LessGreater: "\u2276", lessgtr: "\u2276", LessLess: "\u2AA1", lesssim: "\u2272", LessSlantEqual: "\u2A7D", LessTilde: "\u2272", lfisht: "\u297C", lfloor: "\u230A", Lfr: "\u{1D50F}", lfr: "\u{1D529}", lg: "\u2276", lgE: "\u2A91", lHar: "\u2962", lhard: "\u21BD", lharu: "\u21BC", lharul: "\u296A", lhblk: "\u2584", LJcy: "\u0409", ljcy: "\u0459", llarr: "\u21C7", ll: "\u226A", Ll: "\u22D8", llcorner: "\u231E", Lleftarrow: "\u21DA", llhard: "\u296B", lltri: "\u25FA", Lmidot: "\u013F", lmidot: "\u0140", lmoustache: "\u23B0", lmoust: "\u23B0", lnap: "\u2A89", lnapprox: "\u2A89", lne: "\u2A87", lnE: "\u2268", lneq: "\u2A87", lneqq: "\u2268", lnsim: "\u22E6", loang: "\u27EC", loarr: "\u21FD", lobrk: "\u27E6", longleftarrow: "\u27F5", LongLeftArrow: "\u27F5", Longleftarrow: "\u27F8", longleftrightarrow: "\u27F7", LongLeftRightArrow: "\u27F7", Longleftrightarrow: "\u27FA", longmapsto: "\u27FC", longrightarrow: "\u27F6", LongRightArrow: "\u27F6", Longrightarrow: "\u27F9", looparrowleft: "\u21AB", looparrowright: "\u21AC", lopar: "\u2985", Lopf: "\u{1D543}", lopf: "\u{1D55D}", loplus: "\u2A2D", lotimes: "\u2A34", lowast: "\u2217", lowbar: "_", LowerLeftArrow: "\u2199", LowerRightArrow: "\u2198", loz: "\u25CA", lozenge: "\u25CA", lozf: "\u29EB", lpar: "(", lparlt: "\u2993", lrarr: "\u21C6", lrcorner: "\u231F", lrhar: "\u21CB", lrhard: "\u296D", lrm: "\u200E", lrtri: "\u22BF", lsaquo: "\u2039", lscr: "\u{1D4C1}", Lscr: "\u2112", lsh: "\u21B0", Lsh: "\u21B0", lsim: "\u2272", lsime: "\u2A8D", lsimg: "\u2A8F", lsqb: "[", lsquo: "\u2018", lsquor: "\u201A", Lstrok: "\u0141", lstrok: "\u0142", ltcc: "\u2AA6", ltcir: "\u2A79", lt: "<", LT: "<", Lt: "\u226A", ltdot: "\u22D6", lthree: "\u22CB", ltimes: "\u22C9", ltlarr: "\u2976", ltquest: "\u2A7B", ltri: "\u25C3", ltrie: "\u22B4", ltrif: "\u25C2", ltrPar: "\u2996", lurdshar: "\u294A", luruhar: "\u2966", lvertneqq: "\u2268\uFE00", lvnE: "\u2268\uFE00", macr: "\xAF", male: "\u2642", malt: "\u2720", maltese: "\u2720", Map: "\u2905", map: "\u21A6", mapsto: "\u21A6", mapstodown: "\u21A7", mapstoleft: "\u21A4", mapstoup: "\u21A5", marker: "\u25AE", mcomma: "\u2A29", Mcy: "\u041C", mcy: "\u043C", mdash: "\u2014", mDDot: "\u223A", measuredangle: "\u2221", MediumSpace: "\u205F", Mellintrf: "\u2133", Mfr: "\u{1D510}", mfr: "\u{1D52A}", mho: "\u2127", micro: "\xB5", midast: "*", midcir: "\u2AF0", mid: "\u2223", middot: "\xB7", minusb: "\u229F", minus: "\u2212", minusd: "\u2238", minusdu: "\u2A2A", MinusPlus: "\u2213", mlcp: "\u2ADB", mldr: "\u2026", mnplus: "\u2213", models: "\u22A7", Mopf: "\u{1D544}", mopf: "\u{1D55E}", mp: "\u2213", mscr: "\u{1D4C2}", Mscr: "\u2133", mstpos: "\u223E", Mu: "\u039C", mu: "\u03BC", multimap: "\u22B8", mumap: "\u22B8", nabla: "\u2207", Nacute: "\u0143", nacute: "\u0144", nang: "\u2220\u20D2", nap: "\u2249", napE: "\u2A70\u0338", napid: "\u224B\u0338", napos: "\u0149", napprox: "\u2249", natural: "\u266E", naturals: "\u2115", natur: "\u266E", nbsp: "\xA0", nbump: "\u224E\u0338", nbumpe: "\u224F\u0338", ncap: "\u2A43", Ncaron: "\u0147", ncaron: "\u0148", Ncedil: "\u0145", ncedil: "\u0146", ncong: "\u2247", ncongdot: "\u2A6D\u0338", ncup: "\u2A42", Ncy: "\u041D", ncy: "\u043D", ndash: "\u2013", nearhk: "\u2924", nearr: "\u2197", neArr: "\u21D7", nearrow: "\u2197", ne: "\u2260", nedot: "\u2250\u0338", NegativeMediumSpace: "\u200B", NegativeThickSpace: "\u200B", NegativeThinSpace: "\u200B", NegativeVeryThinSpace: "\u200B", nequiv: "\u2262", nesear: "\u2928", nesim: "\u2242\u0338", NestedGreaterGreater: "\u226B", NestedLessLess: "\u226A", NewLine: "\n", nexist: "\u2204", nexists: "\u2204", Nfr: "\u{1D511}", nfr: "\u{1D52B}", ngE: "\u2267\u0338", nge: "\u2271", ngeq: "\u2271", ngeqq: "\u2267\u0338", ngeqslant: "\u2A7E\u0338", nges: "\u2A7E\u0338", nGg: "\u22D9\u0338", ngsim: "\u2275", nGt: "\u226B\u20D2", ngt: "\u226F", ngtr: "\u226F", nGtv: "\u226B\u0338", nharr: "\u21AE", nhArr: "\u21CE", nhpar: "\u2AF2", ni: "\u220B", nis: "\u22FC", nisd: "\u22FA", niv: "\u220B", NJcy: "\u040A", njcy: "\u045A", nlarr: "\u219A", nlArr: "\u21CD", nldr: "\u2025", nlE: "\u2266\u0338", nle: "\u2270", nleftarrow: "\u219A", nLeftarrow: "\u21CD", nleftrightarrow: "\u21AE", nLeftrightarrow: "\u21CE", nleq: "\u2270", nleqq: "\u2266\u0338", nleqslant: "\u2A7D\u0338", nles: "\u2A7D\u0338", nless: "\u226E", nLl: "\u22D8\u0338", nlsim: "\u2274", nLt: "\u226A\u20D2", nlt: "\u226E", nltri: "\u22EA", nltrie: "\u22EC", nLtv: "\u226A\u0338", nmid: "\u2224", NoBreak: "\u2060", NonBreakingSpace: "\xA0", nopf: "\u{1D55F}", Nopf: "\u2115", Not: "\u2AEC", not: "\xAC", NotCongruent: "\u2262", NotCupCap: "\u226D", NotDoubleVerticalBar: "\u2226", NotElement: "\u2209", NotEqual: "\u2260", NotEqualTilde: "\u2242\u0338", NotExists: "\u2204", NotGreater: "\u226F", NotGreaterEqual: "\u2271", NotGreaterFullEqual: "\u2267\u0338", NotGreaterGreater: "\u226B\u0338", NotGreaterLess: "\u2279", NotGreaterSlantEqual: "\u2A7E\u0338", NotGreaterTilde: "\u2275", NotHumpDownHump: "\u224E\u0338", NotHumpEqual: "\u224F\u0338", notin: "\u2209", notindot: "\u22F5\u0338", notinE: "\u22F9\u0338", notinva: "\u2209", notinvb: "\u22F7", notinvc: "\u22F6", NotLeftTriangleBar: "\u29CF\u0338", NotLeftTriangle: "\u22EA", NotLeftTriangleEqual: "\u22EC", NotLess: "\u226E", NotLessEqual: "\u2270", NotLessGreater: "\u2278", NotLessLess: "\u226A\u0338", NotLessSlantEqual: "\u2A7D\u0338", NotLessTilde: "\u2274", NotNestedGreaterGreater: "\u2AA2\u0338", NotNestedLessLess: "\u2AA1\u0338", notni: "\u220C", notniva: "\u220C", notnivb: "\u22FE", notnivc: "\u22FD", NotPrecedes: "\u2280", NotPrecedesEqual: "\u2AAF\u0338", NotPrecedesSlantEqual: "\u22E0", NotReverseElement: "\u220C", NotRightTriangleBar: "\u29D0\u0338", NotRightTriangle: "\u22EB", NotRightTriangleEqual: "\u22ED", NotSquareSubset: "\u228F\u0338", NotSquareSubsetEqual: "\u22E2", NotSquareSuperset: "\u2290\u0338", NotSquareSupersetEqual: "\u22E3", NotSubset: "\u2282\u20D2", NotSubsetEqual: "\u2288", NotSucceeds: "\u2281", NotSucceedsEqual: "\u2AB0\u0338", NotSucceedsSlantEqual: "\u22E1", NotSucceedsTilde: "\u227F\u0338", NotSuperset: "\u2283\u20D2", NotSupersetEqual: "\u2289", NotTilde: "\u2241", NotTildeEqual: "\u2244", NotTildeFullEqual: "\u2247", NotTildeTilde: "\u2249", NotVerticalBar: "\u2224", nparallel: "\u2226", npar: "\u2226", nparsl: "\u2AFD\u20E5", npart: "\u2202\u0338", npolint: "\u2A14", npr: "\u2280", nprcue: "\u22E0", nprec: "\u2280", npreceq: "\u2AAF\u0338", npre: "\u2AAF\u0338", nrarrc: "\u2933\u0338", nrarr: "\u219B", nrArr: "\u21CF", nrarrw: "\u219D\u0338", nrightarrow: "\u219B", nRightarrow: "\u21CF", nrtri: "\u22EB", nrtrie: "\u22ED", nsc: "\u2281", nsccue: "\u22E1", nsce: "\u2AB0\u0338", Nscr: "\u{1D4A9}", nscr: "\u{1D4C3}", nshortmid: "\u2224", nshortparallel: "\u2226", nsim: "\u2241", nsime: "\u2244", nsimeq: "\u2244", nsmid: "\u2224", nspar: "\u2226", nsqsube: "\u22E2", nsqsupe: "\u22E3", nsub: "\u2284", nsubE: "\u2AC5\u0338", nsube: "\u2288", nsubset: "\u2282\u20D2", nsubseteq: "\u2288", nsubseteqq: "\u2AC5\u0338", nsucc: "\u2281", nsucceq: "\u2AB0\u0338", nsup: "\u2285", nsupE: "\u2AC6\u0338", nsupe: "\u2289", nsupset: "\u2283\u20D2", nsupseteq: "\u2289", nsupseteqq: "\u2AC6\u0338", ntgl: "\u2279", Ntilde: "\xD1", ntilde: "\xF1", ntlg: "\u2278", ntriangleleft: "\u22EA", ntrianglelefteq: "\u22EC", ntriangleright: "\u22EB", ntrianglerighteq: "\u22ED", Nu: "\u039D", nu: "\u03BD", num: "#", numero: "\u2116", numsp: "\u2007", nvap: "\u224D\u20D2", nvdash: "\u22AC", nvDash: "\u22AD", nVdash: "\u22AE", nVDash: "\u22AF", nvge: "\u2265\u20D2", nvgt: ">\u20D2", nvHarr: "\u2904", nvinfin: "\u29DE", nvlArr: "\u2902", nvle: "\u2264\u20D2", nvlt: "<\u20D2", nvltrie: "\u22B4\u20D2", nvrArr: "\u2903", nvrtrie: "\u22B5\u20D2", nvsim: "\u223C\u20D2", nwarhk: "\u2923", nwarr: "\u2196", nwArr: "\u21D6", nwarrow: "\u2196", nwnear: "\u2927", Oacute: "\xD3", oacute: "\xF3", oast: "\u229B", Ocirc: "\xD4", ocirc: "\xF4", ocir: "\u229A", Ocy: "\u041E", ocy: "\u043E", odash: "\u229D", Odblac: "\u0150", odblac: "\u0151", odiv: "\u2A38", odot: "\u2299", odsold: "\u29BC", OElig: "\u0152", oelig: "\u0153", ofcir: "\u29BF", Ofr: "\u{1D512}", ofr: "\u{1D52C}", ogon: "\u02DB", Ograve: "\xD2", ograve: "\xF2", ogt: "\u29C1", ohbar: "\u29B5", ohm: "\u03A9", oint: "\u222E", olarr: "\u21BA", olcir: "\u29BE", olcross: "\u29BB", oline: "\u203E", olt: "\u29C0", Omacr: "\u014C", omacr: "\u014D", Omega: "\u03A9", omega: "\u03C9", Omicron: "\u039F", omicron: "\u03BF", omid: "\u29B6", ominus: "\u2296", Oopf: "\u{1D546}", oopf: "\u{1D560}", opar: "\u29B7", OpenCurlyDoubleQuote: "\u201C", OpenCurlyQuote: "\u2018", operp: "\u29B9", oplus: "\u2295", orarr: "\u21BB", Or: "\u2A54", or: "\u2228", ord: "\u2A5D", order: "\u2134", orderof: "\u2134", ordf: "\xAA", ordm: "\xBA", origof: "\u22B6", oror: "\u2A56", orslope: "\u2A57", orv: "\u2A5B", oS: "\u24C8", Oscr: "\u{1D4AA}", oscr: "\u2134", Oslash: "\xD8", oslash: "\xF8", osol: "\u2298", Otilde: "\xD5", otilde: "\xF5", otimesas: "\u2A36", Otimes: "\u2A37", otimes: "\u2297", Ouml: "\xD6", ouml: "\xF6", ovbar: "\u233D", OverBar: "\u203E", OverBrace: "\u23DE", OverBracket: "\u23B4", OverParenthesis: "\u23DC", para: "\xB6", parallel: "\u2225", par: "\u2225", parsim: "\u2AF3", parsl: "\u2AFD", part: "\u2202", PartialD: "\u2202", Pcy: "\u041F", pcy: "\u043F", percnt: "%", period: ".", permil: "\u2030", perp: "\u22A5", pertenk: "\u2031", Pfr: "\u{1D513}", pfr: "\u{1D52D}", Phi: "\u03A6", phi: "\u03C6", phiv: "\u03D5", phmmat: "\u2133", phone: "\u260E", Pi: "\u03A0", pi: "\u03C0", pitchfork: "\u22D4", piv: "\u03D6", planck: "\u210F", planckh: "\u210E", plankv: "\u210F", plusacir: "\u2A23", plusb: "\u229E", pluscir: "\u2A22", plus: "+", plusdo: "\u2214", plusdu: "\u2A25", pluse: "\u2A72", PlusMinus: "\xB1", plusmn: "\xB1", plussim: "\u2A26", plustwo: "\u2A27", pm: "\xB1", Poincareplane: "\u210C", pointint: "\u2A15", popf: "\u{1D561}", Popf: "\u2119", pound: "\xA3", prap: "\u2AB7", Pr: "\u2ABB", pr: "\u227A", prcue: "\u227C", precapprox: "\u2AB7", prec: "\u227A", preccurlyeq: "\u227C", Precedes: "\u227A", PrecedesEqual: "\u2AAF", PrecedesSlantEqual: "\u227C", PrecedesTilde: "\u227E", preceq: "\u2AAF", precnapprox: "\u2AB9", precneqq: "\u2AB5", precnsim: "\u22E8", pre: "\u2AAF", prE: "\u2AB3", precsim: "\u227E", prime: "\u2032", Prime: "\u2033", primes: "\u2119", prnap: "\u2AB9", prnE: "\u2AB5", prnsim: "\u22E8", prod: "\u220F", Product: "\u220F", profalar: "\u232E", profline: "\u2312", profsurf: "\u2313", prop: "\u221D", Proportional: "\u221D", Proportion: "\u2237", propto: "\u221D", prsim: "\u227E", prurel: "\u22B0", Pscr: "\u{1D4AB}", pscr: "\u{1D4C5}", Psi: "\u03A8", psi: "\u03C8", puncsp: "\u2008", Qfr: "\u{1D514}", qfr: "\u{1D52E}", qint: "\u2A0C", qopf: "\u{1D562}", Qopf: "\u211A", qprime: "\u2057", Qscr: "\u{1D4AC}", qscr: "\u{1D4C6}", quaternions: "\u210D", quatint: "\u2A16", quest: "?", questeq: "\u225F", quot: '"', QUOT: '"', rAarr: "\u21DB", race: "\u223D\u0331", Racute: "\u0154", racute: "\u0155", radic: "\u221A", raemptyv: "\u29B3", rang: "\u27E9", Rang: "\u27EB", rangd: "\u2992", range: "\u29A5", rangle: "\u27E9", raquo: "\xBB", rarrap: "\u2975", rarrb: "\u21E5", rarrbfs: "\u2920", rarrc: "\u2933", rarr: "\u2192", Rarr: "\u21A0", rArr: "\u21D2", rarrfs: "\u291E", rarrhk: "\u21AA", rarrlp: "\u21AC", rarrpl: "\u2945", rarrsim: "\u2974", Rarrtl: "\u2916", rarrtl: "\u21A3", rarrw: "\u219D", ratail: "\u291A", rAtail: "\u291C", ratio: "\u2236", rationals: "\u211A", rbarr: "\u290D", rBarr: "\u290F", RBarr: "\u2910", rbbrk: "\u2773", rbrace: "}", rbrack: "]", rbrke: "\u298C", rbrksld: "\u298E", rbrkslu: "\u2990", Rcaron: "\u0158", rcaron: "\u0159", Rcedil: "\u0156", rcedil: "\u0157", rceil: "\u2309", rcub: "}", Rcy: "\u0420", rcy: "\u0440", rdca: "\u2937", rdldhar: "\u2969", rdquo: "\u201D", rdquor: "\u201D", rdsh: "\u21B3", real: "\u211C", realine: "\u211B", realpart: "\u211C", reals: "\u211D", Re: "\u211C", rect: "\u25AD", reg: "\xAE", REG: "\xAE", ReverseElement: "\u220B", ReverseEquilibrium: "\u21CB", ReverseUpEquilibrium: "\u296F", rfisht: "\u297D", rfloor: "\u230B", rfr: "\u{1D52F}", Rfr: "\u211C", rHar: "\u2964", rhard: "\u21C1", rharu: "\u21C0", rharul: "\u296C", Rho: "\u03A1", rho: "\u03C1", rhov: "\u03F1", RightAngleBracket: "\u27E9", RightArrowBar: "\u21E5", rightarrow: "\u2192", RightArrow: "\u2192", Rightarrow: "\u21D2", RightArrowLeftArrow: "\u21C4", rightarrowtail: "\u21A3", RightCeiling: "\u2309", RightDoubleBracket: "\u27E7", RightDownTeeVector: "\u295D", RightDownVectorBar: "\u2955", RightDownVector: "\u21C2", RightFloor: "\u230B", rightharpoondown: "\u21C1", rightharpoonup: "\u21C0", rightleftarrows: "\u21C4", rightleftharpoons: "\u21CC", rightrightarrows: "\u21C9", rightsquigarrow: "\u219D", RightTeeArrow: "\u21A6", RightTee: "\u22A2", RightTeeVector: "\u295B", rightthreetimes: "\u22CC", RightTriangleBar: "\u29D0", RightTriangle: "\u22B3", RightTriangleEqual: "\u22B5", RightUpDownVector: "\u294F", RightUpTeeVector: "\u295C", RightUpVectorBar: "\u2954", RightUpVector: "\u21BE", RightVectorBar: "\u2953", RightVector: "\u21C0", ring: "\u02DA", risingdotseq: "\u2253", rlarr: "\u21C4", rlhar: "\u21CC", rlm: "\u200F", rmoustache: "\u23B1", rmoust: "\u23B1", rnmid: "\u2AEE", roang: "\u27ED", roarr: "\u21FE", robrk: "\u27E7", ropar: "\u2986", ropf: "\u{1D563}", Ropf: "\u211D", roplus: "\u2A2E", rotimes: "\u2A35", RoundImplies: "\u2970", rpar: ")", rpargt: "\u2994", rppolint: "\u2A12", rrarr: "\u21C9", Rrightarrow: "\u21DB", rsaquo: "\u203A", rscr: "\u{1D4C7}", Rscr: "\u211B", rsh: "\u21B1", Rsh: "\u21B1", rsqb: "]", rsquo: "\u2019", rsquor: "\u2019", rthree: "\u22CC", rtimes: "\u22CA", rtri: "\u25B9", rtrie: "\u22B5", rtrif: "\u25B8", rtriltri: "\u29CE", RuleDelayed: "\u29F4", ruluhar: "\u2968", rx: "\u211E", Sacute: "\u015A", sacute: "\u015B", sbquo: "\u201A", scap: "\u2AB8", Scaron: "\u0160", scaron: "\u0161", Sc: "\u2ABC", sc: "\u227B", sccue: "\u227D", sce: "\u2AB0", scE: "\u2AB4", Scedil: "\u015E", scedil: "\u015F", Scirc: "\u015C", scirc: "\u015D", scnap: "\u2ABA", scnE: "\u2AB6", scnsim: "\u22E9", scpolint: "\u2A13", scsim: "\u227F", Scy: "\u0421", scy: "\u0441", sdotb: "\u22A1", sdot: "\u22C5", sdote: "\u2A66", searhk: "\u2925", searr: "\u2198", seArr: "\u21D8", searrow: "\u2198", sect: "\xA7", semi: ";", seswar: "\u2929", setminus: "\u2216", setmn: "\u2216", sext: "\u2736", Sfr: "\u{1D516}", sfr: "\u{1D530}", sfrown: "\u2322", sharp: "\u266F", SHCHcy: "\u0429", shchcy: "\u0449", SHcy: "\u0428", shcy: "\u0448", ShortDownArrow: "\u2193", ShortLeftArrow: "\u2190", shortmid: "\u2223", shortparallel: "\u2225", ShortRightArrow: "\u2192", ShortUpArrow: "\u2191", shy: "\xAD", Sigma: "\u03A3", sigma: "\u03C3", sigmaf: "\u03C2", sigmav: "\u03C2", sim: "\u223C", simdot: "\u2A6A", sime: "\u2243", simeq: "\u2243", simg: "\u2A9E", simgE: "\u2AA0", siml: "\u2A9D", simlE: "\u2A9F", simne: "\u2246", simplus: "\u2A24", simrarr: "\u2972", slarr: "\u2190", SmallCircle: "\u2218", smallsetminus: "\u2216", smashp: "\u2A33", smeparsl: "\u29E4", smid: "\u2223", smile: "\u2323", smt: "\u2AAA", smte: "\u2AAC", smtes: "\u2AAC\uFE00", SOFTcy: "\u042C", softcy: "\u044C", solbar: "\u233F", solb: "\u29C4", sol: "/", Sopf: "\u{1D54A}", sopf: "\u{1D564}", spades: "\u2660", spadesuit: "\u2660", spar: "\u2225", sqcap: "\u2293", sqcaps: "\u2293\uFE00", sqcup: "\u2294", sqcups: "\u2294\uFE00", Sqrt: "\u221A", sqsub: "\u228F", sqsube: "\u2291", sqsubset: "\u228F", sqsubseteq: "\u2291", sqsup: "\u2290", sqsupe: "\u2292", sqsupset: "\u2290", sqsupseteq: "\u2292", square: "\u25A1", Square: "\u25A1", SquareIntersection: "\u2293", SquareSubset: "\u228F", SquareSubsetEqual: "\u2291", SquareSuperset: "\u2290", SquareSupersetEqual: "\u2292", SquareUnion: "\u2294", squarf: "\u25AA", squ: "\u25A1", squf: "\u25AA", srarr: "\u2192", Sscr: "\u{1D4AE}", sscr: "\u{1D4C8}", ssetmn: "\u2216", ssmile: "\u2323", sstarf: "\u22C6", Star: "\u22C6", star: "\u2606", starf: "\u2605", straightepsilon: "\u03F5", straightphi: "\u03D5", strns: "\xAF", sub: "\u2282", Sub: "\u22D0", subdot: "\u2ABD", subE: "\u2AC5", sube: "\u2286", subedot: "\u2AC3", submult: "\u2AC1", subnE: "\u2ACB", subne: "\u228A", subplus: "\u2ABF", subrarr: "\u2979", subset: "\u2282", Subset: "\u22D0", subseteq: "\u2286", subseteqq: "\u2AC5", SubsetEqual: "\u2286", subsetneq: "\u228A", subsetneqq: "\u2ACB", subsim: "\u2AC7", subsub: "\u2AD5", subsup: "\u2AD3", succapprox: "\u2AB8", succ: "\u227B", succcurlyeq: "\u227D", Succeeds: "\u227B", SucceedsEqual: "\u2AB0", SucceedsSlantEqual: "\u227D", SucceedsTilde: "\u227F", succeq: "\u2AB0", succnapprox: "\u2ABA", succneqq: "\u2AB6", succnsim: "\u22E9", succsim: "\u227F", SuchThat: "\u220B", sum: "\u2211", Sum: "\u2211", sung: "\u266A", sup1: "\xB9", sup2: "\xB2", sup3: "\xB3", sup: "\u2283", Sup: "\u22D1", supdot: "\u2ABE", supdsub: "\u2AD8", supE: "\u2AC6", supe: "\u2287", supedot: "\u2AC4", Superset: "\u2283", SupersetEqual: "\u2287", suphsol: "\u27C9", suphsub: "\u2AD7", suplarr: "\u297B", supmult: "\u2AC2", supnE: "\u2ACC", supne: "\u228B", supplus: "\u2AC0", supset: "\u2283", Supset: "\u22D1", supseteq: "\u2287", supseteqq: "\u2AC6", supsetneq: "\u228B", supsetneqq: "\u2ACC", supsim: "\u2AC8", supsub: "\u2AD4", supsup: "\u2AD6", swarhk: "\u2926", swarr: "\u2199", swArr: "\u21D9", swarrow: "\u2199", swnwar: "\u292A", szlig: "\xDF", Tab: "	", target: "\u2316", Tau: "\u03A4", tau: "\u03C4", tbrk: "\u23B4", Tcaron: "\u0164", tcaron: "\u0165", Tcedil: "\u0162", tcedil: "\u0163", Tcy: "\u0422", tcy: "\u0442", tdot: "\u20DB", telrec: "\u2315", Tfr: "\u{1D517}", tfr: "\u{1D531}", there4: "\u2234", therefore: "\u2234", Therefore: "\u2234", Theta: "\u0398", theta: "\u03B8", thetasym: "\u03D1", thetav: "\u03D1", thickapprox: "\u2248", thicksim: "\u223C", ThickSpace: "\u205F\u200A", ThinSpace: "\u2009", thinsp: "\u2009", thkap: "\u2248", thksim: "\u223C", THORN: "\xDE", thorn: "\xFE", tilde: "\u02DC", Tilde: "\u223C", TildeEqual: "\u2243", TildeFullEqual: "\u2245", TildeTilde: "\u2248", timesbar: "\u2A31", timesb: "\u22A0", times: "\xD7", timesd: "\u2A30", tint: "\u222D", toea: "\u2928", topbot: "\u2336", topcir: "\u2AF1", top: "\u22A4", Topf: "\u{1D54B}", topf: "\u{1D565}", topfork: "\u2ADA", tosa: "\u2929", tprime: "\u2034", trade: "\u2122", TRADE: "\u2122", triangle: "\u25B5", triangledown: "\u25BF", triangleleft: "\u25C3", trianglelefteq: "\u22B4", triangleq: "\u225C", triangleright: "\u25B9", trianglerighteq: "\u22B5", tridot: "\u25EC", trie: "\u225C", triminus: "\u2A3A", TripleDot: "\u20DB", triplus: "\u2A39", trisb: "\u29CD", tritime: "\u2A3B", trpezium: "\u23E2", Tscr: "\u{1D4AF}", tscr: "\u{1D4C9}", TScy: "\u0426", tscy: "\u0446", TSHcy: "\u040B", tshcy: "\u045B", Tstrok: "\u0166", tstrok: "\u0167", twixt: "\u226C", twoheadleftarrow: "\u219E", twoheadrightarrow: "\u21A0", Uacute: "\xDA", uacute: "\xFA", uarr: "\u2191", Uarr: "\u219F", uArr: "\u21D1", Uarrocir: "\u2949", Ubrcy: "\u040E", ubrcy: "\u045E", Ubreve: "\u016C", ubreve: "\u016D", Ucirc: "\xDB", ucirc: "\xFB", Ucy: "\u0423", ucy: "\u0443", udarr: "\u21C5", Udblac: "\u0170", udblac: "\u0171", udhar: "\u296E", ufisht: "\u297E", Ufr: "\u{1D518}", ufr: "\u{1D532}", Ugrave: "\xD9", ugrave: "\xF9", uHar: "\u2963", uharl: "\u21BF", uharr: "\u21BE", uhblk: "\u2580", ulcorn: "\u231C", ulcorner: "\u231C", ulcrop: "\u230F", ultri: "\u25F8", Umacr: "\u016A", umacr: "\u016B", uml: "\xA8", UnderBar: "_", UnderBrace: "\u23DF", UnderBracket: "\u23B5", UnderParenthesis: "\u23DD", Union: "\u22C3", UnionPlus: "\u228E", Uogon: "\u0172", uogon: "\u0173", Uopf: "\u{1D54C}", uopf: "\u{1D566}", UpArrowBar: "\u2912", uparrow: "\u2191", UpArrow: "\u2191", Uparrow: "\u21D1", UpArrowDownArrow: "\u21C5", updownarrow: "\u2195", UpDownArrow: "\u2195", Updownarrow: "\u21D5", UpEquilibrium: "\u296E", upharpoonleft: "\u21BF", upharpoonright: "\u21BE", uplus: "\u228E", UpperLeftArrow: "\u2196", UpperRightArrow: "\u2197", upsi: "\u03C5", Upsi: "\u03D2", upsih: "\u03D2", Upsilon: "\u03A5", upsilon: "\u03C5", UpTeeArrow: "\u21A5", UpTee: "\u22A5", upuparrows: "\u21C8", urcorn: "\u231D", urcorner: "\u231D", urcrop: "\u230E", Uring: "\u016E", uring: "\u016F", urtri: "\u25F9", Uscr: "\u{1D4B0}", uscr: "\u{1D4CA}", utdot: "\u22F0", Utilde: "\u0168", utilde: "\u0169", utri: "\u25B5", utrif: "\u25B4", uuarr: "\u21C8", Uuml: "\xDC", uuml: "\xFC", uwangle: "\u29A7", vangrt: "\u299C", varepsilon: "\u03F5", varkappa: "\u03F0", varnothing: "\u2205", varphi: "\u03D5", varpi: "\u03D6", varpropto: "\u221D", varr: "\u2195", vArr: "\u21D5", varrho: "\u03F1", varsigma: "\u03C2", varsubsetneq: "\u228A\uFE00", varsubsetneqq: "\u2ACB\uFE00", varsupsetneq: "\u228B\uFE00", varsupsetneqq: "\u2ACC\uFE00", vartheta: "\u03D1", vartriangleleft: "\u22B2", vartriangleright: "\u22B3", vBar: "\u2AE8", Vbar: "\u2AEB", vBarv: "\u2AE9", Vcy: "\u0412", vcy: "\u0432", vdash: "\u22A2", vDash: "\u22A8", Vdash: "\u22A9", VDash: "\u22AB", Vdashl: "\u2AE6", veebar: "\u22BB", vee: "\u2228", Vee: "\u22C1", veeeq: "\u225A", vellip: "\u22EE", verbar: "|", Verbar: "\u2016", vert: "|", Vert: "\u2016", VerticalBar: "\u2223", VerticalLine: "|", VerticalSeparator: "\u2758", VerticalTilde: "\u2240", VeryThinSpace: "\u200A", Vfr: "\u{1D519}", vfr: "\u{1D533}", vltri: "\u22B2", vnsub: "\u2282\u20D2", vnsup: "\u2283\u20D2", Vopf: "\u{1D54D}", vopf: "\u{1D567}", vprop: "\u221D", vrtri: "\u22B3", Vscr: "\u{1D4B1}", vscr: "\u{1D4CB}", vsubnE: "\u2ACB\uFE00", vsubne: "\u228A\uFE00", vsupnE: "\u2ACC\uFE00", vsupne: "\u228B\uFE00", Vvdash: "\u22AA", vzigzag: "\u299A", Wcirc: "\u0174", wcirc: "\u0175", wedbar: "\u2A5F", wedge: "\u2227", Wedge: "\u22C0", wedgeq: "\u2259", weierp: "\u2118", Wfr: "\u{1D51A}", wfr: "\u{1D534}", Wopf: "\u{1D54E}", wopf: "\u{1D568}", wp: "\u2118", wr: "\u2240", wreath: "\u2240", Wscr: "\u{1D4B2}", wscr: "\u{1D4CC}", xcap: "\u22C2", xcirc: "\u25EF", xcup: "\u22C3", xdtri: "\u25BD", Xfr: "\u{1D51B}", xfr: "\u{1D535}", xharr: "\u27F7", xhArr: "\u27FA", Xi: "\u039E", xi: "\u03BE", xlarr: "\u27F5", xlArr: "\u27F8", xmap: "\u27FC", xnis: "\u22FB", xodot: "\u2A00", Xopf: "\u{1D54F}", xopf: "\u{1D569}", xoplus: "\u2A01", xotime: "\u2A02", xrarr: "\u27F6", xrArr: "\u27F9", Xscr: "\u{1D4B3}", xscr: "\u{1D4CD}", xsqcup: "\u2A06", xuplus: "\u2A04", xutri: "\u25B3", xvee: "\u22C1", xwedge: "\u22C0", Yacute: "\xDD", yacute: "\xFD", YAcy: "\u042F", yacy: "\u044F", Ycirc: "\u0176", ycirc: "\u0177", Ycy: "\u042B", ycy: "\u044B", yen: "\xA5", Yfr: "\u{1D51C}", yfr: "\u{1D536}", YIcy: "\u0407", yicy: "\u0457", Yopf: "\u{1D550}", yopf: "\u{1D56A}", Yscr: "\u{1D4B4}", yscr: "\u{1D4CE}", YUcy: "\u042E", yucy: "\u044E", yuml: "\xFF", Yuml: "\u0178", Zacute: "\u0179", zacute: "\u017A", Zcaron: "\u017D", zcaron: "\u017E", Zcy: "\u0417", zcy: "\u0437", Zdot: "\u017B", zdot: "\u017C", zeetrf: "\u2128", ZeroWidthSpace: "\u200B", Zeta: "\u0396", zeta: "\u03B6", zfr: "\u{1D537}", Zfr: "\u2128", ZHcy: "\u0416", zhcy: "\u0436", zigrarr: "\u21DD", zopf: "\u{1D56B}", Zopf: "\u2124", Zscr: "\u{1D4B5}", zscr: "\u{1D4CF}", zwj: "\u200D", zwnj: "\u200C" };
      }
    });
    require_entities2 = __commonJS2({
      "node_modules/markdown-it/lib/common/entities.js"(exports, module) {
        "use strict";
        module.exports = require_entities();
      }
    });
    require_regex = __commonJS2({
      "node_modules/uc.micro/categories/P/regex.js"(exports, module) {
        module.exports = /[!-#%-\*,-\/:;\?@\[-\]_\{\}\xA1\xA7\xAB\xB6\xB7\xBB\xBF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061E\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u09FD\u0A76\u0AF0\u0C84\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166D\u166E\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2010-\u2027\u2030-\u2043\u2045-\u2051\u2053-\u205E\u207D\u207E\u208D\u208E\u2308-\u230B\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E4E\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]|\uD800[\uDD00-\uDD02\uDF9F\uDFD0]|\uD801\uDD6F|\uD802[\uDC57\uDD1F\uDD3F\uDE50-\uDE58\uDE7F\uDEF0-\uDEF6\uDF39-\uDF3F\uDF99-\uDF9C]|\uD803[\uDF55-\uDF59]|\uD804[\uDC47-\uDC4D\uDCBB\uDCBC\uDCBE-\uDCC1\uDD40-\uDD43\uDD74\uDD75\uDDC5-\uDDC8\uDDCD\uDDDB\uDDDD-\uDDDF\uDE38-\uDE3D\uDEA9]|\uD805[\uDC4B-\uDC4F\uDC5B\uDC5D\uDCC6\uDDC1-\uDDD7\uDE41-\uDE43\uDE60-\uDE6C\uDF3C-\uDF3E]|\uD806[\uDC3B\uDE3F-\uDE46\uDE9A-\uDE9C\uDE9E-\uDEA2]|\uD807[\uDC41-\uDC45\uDC70\uDC71\uDEF7\uDEF8]|\uD809[\uDC70-\uDC74]|\uD81A[\uDE6E\uDE6F\uDEF5\uDF37-\uDF3B\uDF44]|\uD81B[\uDE97-\uDE9A]|\uD82F\uDC9F|\uD836[\uDE87-\uDE8B]|\uD83A[\uDD5E\uDD5F]/;
      }
    });
    require_encode = __commonJS2({
      "node_modules/mdurl/encode.js"(exports, module) {
        "use strict";
        var encodeCache = {};
        function getEncodeCache(exclude) {
          var i, ch, cache = encodeCache[exclude];
          if (cache) {
            return cache;
          }
          cache = encodeCache[exclude] = [];
          for (i = 0; i < 128; i++) {
            ch = String.fromCharCode(i);
            if (/^[0-9a-z]$/i.test(ch)) {
              cache.push(ch);
            } else {
              cache.push("%" + ("0" + i.toString(16).toUpperCase()).slice(-2));
            }
          }
          for (i = 0; i < exclude.length; i++) {
            cache[exclude.charCodeAt(i)] = exclude[i];
          }
          return cache;
        }
        __name(getEncodeCache, "getEncodeCache");
        function encode(string2, exclude, keepEscaped) {
          var i, l, code2, nextCode, cache, result = "";
          if (typeof exclude !== "string") {
            keepEscaped = exclude;
            exclude = encode.defaultChars;
          }
          if (typeof keepEscaped === "undefined") {
            keepEscaped = true;
          }
          cache = getEncodeCache(exclude);
          for (i = 0, l = string2.length; i < l; i++) {
            code2 = string2.charCodeAt(i);
            if (keepEscaped && code2 === 37 && i + 2 < l) {
              if (/^[0-9a-f]{2}$/i.test(string2.slice(i + 1, i + 3))) {
                result += string2.slice(i, i + 3);
                i += 2;
                continue;
              }
            }
            if (code2 < 128) {
              result += cache[code2];
              continue;
            }
            if (code2 >= 55296 && code2 <= 57343) {
              if (code2 >= 55296 && code2 <= 56319 && i + 1 < l) {
                nextCode = string2.charCodeAt(i + 1);
                if (nextCode >= 56320 && nextCode <= 57343) {
                  result += encodeURIComponent(string2[i] + string2[i + 1]);
                  i++;
                  continue;
                }
              }
              result += "%EF%BF%BD";
              continue;
            }
            result += encodeURIComponent(string2[i]);
          }
          return result;
        }
        __name(encode, "encode");
        encode.defaultChars = ";/?:@&=+$,-_.!~*'()#";
        encode.componentChars = "-_.!~*'()";
        module.exports = encode;
      }
    });
    require_decode = __commonJS2({
      "node_modules/mdurl/decode.js"(exports, module) {
        "use strict";
        var decodeCache = {};
        function getDecodeCache(exclude) {
          var i, ch, cache = decodeCache[exclude];
          if (cache) {
            return cache;
          }
          cache = decodeCache[exclude] = [];
          for (i = 0; i < 128; i++) {
            ch = String.fromCharCode(i);
            cache.push(ch);
          }
          for (i = 0; i < exclude.length; i++) {
            ch = exclude.charCodeAt(i);
            cache[ch] = "%" + ("0" + ch.toString(16).toUpperCase()).slice(-2);
          }
          return cache;
        }
        __name(getDecodeCache, "getDecodeCache");
        function decode(string2, exclude) {
          var cache;
          if (typeof exclude !== "string") {
            exclude = decode.defaultChars;
          }
          cache = getDecodeCache(exclude);
          return string2.replace(/(%[a-f0-9]{2})+/gi, function(seq) {
            var i, l, b1, b2, b3, b4, chr, result = "";
            for (i = 0, l = seq.length; i < l; i += 3) {
              b1 = parseInt(seq.slice(i + 1, i + 3), 16);
              if (b1 < 128) {
                result += cache[b1];
                continue;
              }
              if ((b1 & 224) === 192 && i + 3 < l) {
                b2 = parseInt(seq.slice(i + 4, i + 6), 16);
                if ((b2 & 192) === 128) {
                  chr = b1 << 6 & 1984 | b2 & 63;
                  if (chr < 128) {
                    result += "\uFFFD\uFFFD";
                  } else {
                    result += String.fromCharCode(chr);
                  }
                  i += 3;
                  continue;
                }
              }
              if ((b1 & 240) === 224 && i + 6 < l) {
                b2 = parseInt(seq.slice(i + 4, i + 6), 16);
                b3 = parseInt(seq.slice(i + 7, i + 9), 16);
                if ((b2 & 192) === 128 && (b3 & 192) === 128) {
                  chr = b1 << 12 & 61440 | b2 << 6 & 4032 | b3 & 63;
                  if (chr < 2048 || chr >= 55296 && chr <= 57343) {
                    result += "\uFFFD\uFFFD\uFFFD";
                  } else {
                    result += String.fromCharCode(chr);
                  }
                  i += 6;
                  continue;
                }
              }
              if ((b1 & 248) === 240 && i + 9 < l) {
                b2 = parseInt(seq.slice(i + 4, i + 6), 16);
                b3 = parseInt(seq.slice(i + 7, i + 9), 16);
                b4 = parseInt(seq.slice(i + 10, i + 12), 16);
                if ((b2 & 192) === 128 && (b3 & 192) === 128 && (b4 & 192) === 128) {
                  chr = b1 << 18 & 1835008 | b2 << 12 & 258048 | b3 << 6 & 4032 | b4 & 63;
                  if (chr < 65536 || chr > 1114111) {
                    result += "\uFFFD\uFFFD\uFFFD\uFFFD";
                  } else {
                    chr -= 65536;
                    result += String.fromCharCode(55296 + (chr >> 10), 56320 + (chr & 1023));
                  }
                  i += 9;
                  continue;
                }
              }
              result += "\uFFFD";
            }
            return result;
          });
        }
        __name(decode, "decode");
        decode.defaultChars = ";/?:@&=+$,#";
        decode.componentChars = "";
        module.exports = decode;
      }
    });
    require_format = __commonJS2({
      "node_modules/mdurl/format.js"(exports, module) {
        "use strict";
        module.exports = /* @__PURE__ */ __name(function format2(url2) {
          var result = "";
          result += url2.protocol || "";
          result += url2.slashes ? "//" : "";
          result += url2.auth ? url2.auth + "@" : "";
          if (url2.hostname && url2.hostname.indexOf(":") !== -1) {
            result += "[" + url2.hostname + "]";
          } else {
            result += url2.hostname || "";
          }
          result += url2.port ? ":" + url2.port : "";
          result += url2.pathname || "";
          result += url2.search || "";
          result += url2.hash || "";
          return result;
        }, "format2");
      }
    });
    require_parse = __commonJS2({
      "node_modules/mdurl/parse.js"(exports, module) {
        "use strict";
        function Url() {
          this.protocol = null;
          this.slashes = null;
          this.auth = null;
          this.port = null;
          this.hostname = null;
          this.hash = null;
          this.search = null;
          this.pathname = null;
        }
        __name(Url, "Url");
        var protocolPattern = /^([a-z0-9.+-]+:)/i;
        var portPattern = /:[0-9]*$/;
        var simplePathPattern = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/;
        var delims = ["<", ">", '"', "`", " ", "\r", "\n", "	"];
        var unwise = ["{", "}", "|", "\\", "^", "`"].concat(delims);
        var autoEscape = ["'"].concat(unwise);
        var nonHostChars = ["%", "/", "?", ";", "#"].concat(autoEscape);
        var hostEndingChars = ["/", "?", "#"];
        var hostnameMaxLen = 255;
        var hostnamePartPattern = /^[+a-z0-9A-Z_-]{0,63}$/;
        var hostnamePartStart = /^([+a-z0-9A-Z_-]{0,63})(.*)$/;
        var hostlessProtocol = {
          "javascript": true,
          "javascript:": true
        };
        var slashedProtocol = {
          "http": true,
          "https": true,
          "ftp": true,
          "gopher": true,
          "file": true,
          "http:": true,
          "https:": true,
          "ftp:": true,
          "gopher:": true,
          "file:": true
        };
        function urlParse(url2, slashesDenoteHost) {
          if (url2 && url2 instanceof Url) {
            return url2;
          }
          var u = new Url();
          u.parse(url2, slashesDenoteHost);
          return u;
        }
        __name(urlParse, "urlParse");
        Url.prototype.parse = function(url2, slashesDenoteHost) {
          var i, l, lowerProto, hec, slashes, rest = url2;
          rest = rest.trim();
          if (!slashesDenoteHost && url2.split("#").length === 1) {
            var simplePath = simplePathPattern.exec(rest);
            if (simplePath) {
              this.pathname = simplePath[1];
              if (simplePath[2]) {
                this.search = simplePath[2];
              }
              return this;
            }
          }
          var proto = protocolPattern.exec(rest);
          if (proto) {
            proto = proto[0];
            lowerProto = proto.toLowerCase();
            this.protocol = proto;
            rest = rest.substr(proto.length);
          }
          if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
            slashes = rest.substr(0, 2) === "//";
            if (slashes && !(proto && hostlessProtocol[proto])) {
              rest = rest.substr(2);
              this.slashes = true;
            }
          }
          if (!hostlessProtocol[proto] && (slashes || proto && !slashedProtocol[proto])) {
            var hostEnd = -1;
            for (i = 0; i < hostEndingChars.length; i++) {
              hec = rest.indexOf(hostEndingChars[i]);
              if (hec !== -1 && (hostEnd === -1 || hec < hostEnd)) {
                hostEnd = hec;
              }
            }
            var auth, atSign;
            if (hostEnd === -1) {
              atSign = rest.lastIndexOf("@");
            } else {
              atSign = rest.lastIndexOf("@", hostEnd);
            }
            if (atSign !== -1) {
              auth = rest.slice(0, atSign);
              rest = rest.slice(atSign + 1);
              this.auth = auth;
            }
            hostEnd = -1;
            for (i = 0; i < nonHostChars.length; i++) {
              hec = rest.indexOf(nonHostChars[i]);
              if (hec !== -1 && (hostEnd === -1 || hec < hostEnd)) {
                hostEnd = hec;
              }
            }
            if (hostEnd === -1) {
              hostEnd = rest.length;
            }
            if (rest[hostEnd - 1] === ":") {
              hostEnd--;
            }
            var host = rest.slice(0, hostEnd);
            rest = rest.slice(hostEnd);
            this.parseHost(host);
            this.hostname = this.hostname || "";
            var ipv6Hostname = this.hostname[0] === "[" && this.hostname[this.hostname.length - 1] === "]";
            if (!ipv6Hostname) {
              var hostparts = this.hostname.split(/\./);
              for (i = 0, l = hostparts.length; i < l; i++) {
                var part = hostparts[i];
                if (!part) {
                  continue;
                }
                if (!part.match(hostnamePartPattern)) {
                  var newpart = "";
                  for (var j = 0, k = part.length; j < k; j++) {
                    if (part.charCodeAt(j) > 127) {
                      newpart += "x";
                    } else {
                      newpart += part[j];
                    }
                  }
                  if (!newpart.match(hostnamePartPattern)) {
                    var validParts = hostparts.slice(0, i);
                    var notHost = hostparts.slice(i + 1);
                    var bit = part.match(hostnamePartStart);
                    if (bit) {
                      validParts.push(bit[1]);
                      notHost.unshift(bit[2]);
                    }
                    if (notHost.length) {
                      rest = notHost.join(".") + rest;
                    }
                    this.hostname = validParts.join(".");
                    break;
                  }
                }
              }
            }
            if (this.hostname.length > hostnameMaxLen) {
              this.hostname = "";
            }
            if (ipv6Hostname) {
              this.hostname = this.hostname.substr(1, this.hostname.length - 2);
            }
          }
          var hash = rest.indexOf("#");
          if (hash !== -1) {
            this.hash = rest.substr(hash);
            rest = rest.slice(0, hash);
          }
          var qm = rest.indexOf("?");
          if (qm !== -1) {
            this.search = rest.substr(qm);
            rest = rest.slice(0, qm);
          }
          if (rest) {
            this.pathname = rest;
          }
          if (slashedProtocol[lowerProto] && this.hostname && !this.pathname) {
            this.pathname = "";
          }
          return this;
        };
        Url.prototype.parseHost = function(host) {
          var port = portPattern.exec(host);
          if (port) {
            port = port[0];
            if (port !== ":") {
              this.port = port.substr(1);
            }
            host = host.substr(0, host.length - port.length);
          }
          if (host) {
            this.hostname = host;
          }
        };
        module.exports = urlParse;
      }
    });
    require_mdurl = __commonJS2({
      "node_modules/mdurl/index.js"(exports, module) {
        "use strict";
        module.exports.encode = require_encode();
        module.exports.decode = require_decode();
        module.exports.format = require_format();
        module.exports.parse = require_parse();
      }
    });
    require_regex2 = __commonJS2({
      "node_modules/uc.micro/properties/Any/regex.js"(exports, module) {
        module.exports = /[\0-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
      }
    });
    require_regex3 = __commonJS2({
      "node_modules/uc.micro/categories/Cc/regex.js"(exports, module) {
        module.exports = /[\0-\x1F\x7F-\x9F]/;
      }
    });
    require_regex4 = __commonJS2({
      "node_modules/uc.micro/categories/Cf/regex.js"(exports, module) {
        module.exports = /[\xAD\u0600-\u0605\u061C\u06DD\u070F\u08E2\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB]|\uD804[\uDCBD\uDCCD]|\uD82F[\uDCA0-\uDCA3]|\uD834[\uDD73-\uDD7A]|\uDB40[\uDC01\uDC20-\uDC7F]/;
      }
    });
    require_regex5 = __commonJS2({
      "node_modules/uc.micro/categories/Z/regex.js"(exports, module) {
        module.exports = /[ \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/;
      }
    });
    require_uc = __commonJS2({
      "node_modules/uc.micro/index.js"(exports) {
        "use strict";
        exports.Any = require_regex2();
        exports.Cc = require_regex3();
        exports.Cf = require_regex4();
        exports.P = require_regex();
        exports.Z = require_regex5();
      }
    });
    require_utils = __commonJS2({
      "node_modules/markdown-it/lib/common/utils.js"(exports) {
        "use strict";
        function _class(obj) {
          return Object.prototype.toString.call(obj);
        }
        __name(_class, "_class");
        function isString2(obj) {
          return _class(obj) === "[object String]";
        }
        __name(isString2, "isString");
        var _hasOwnProperty = Object.prototype.hasOwnProperty;
        function has(object2, key) {
          return _hasOwnProperty.call(object2, key);
        }
        __name(has, "has");
        function assign(obj) {
          var sources = Array.prototype.slice.call(arguments, 1);
          sources.forEach(function(source) {
            if (!source) {
              return;
            }
            if (typeof source !== "object") {
              throw new TypeError(source + "must be object");
            }
            Object.keys(source).forEach(function(key) {
              obj[key] = source[key];
            });
          });
          return obj;
        }
        __name(assign, "assign");
        function arrayReplaceAt(src, pos, newElements) {
          return [].concat(src.slice(0, pos), newElements, src.slice(pos + 1));
        }
        __name(arrayReplaceAt, "arrayReplaceAt");
        function isValidEntityCode(c) {
          if (c >= 55296 && c <= 57343) {
            return false;
          }
          if (c >= 64976 && c <= 65007) {
            return false;
          }
          if ((c & 65535) === 65535 || (c & 65535) === 65534) {
            return false;
          }
          if (c >= 0 && c <= 8) {
            return false;
          }
          if (c === 11) {
            return false;
          }
          if (c >= 14 && c <= 31) {
            return false;
          }
          if (c >= 127 && c <= 159) {
            return false;
          }
          if (c > 1114111) {
            return false;
          }
          return true;
        }
        __name(isValidEntityCode, "isValidEntityCode");
        function fromCodePoint(c) {
          if (c > 65535) {
            c -= 65536;
            var surrogate1 = 55296 + (c >> 10), surrogate2 = 56320 + (c & 1023);
            return String.fromCharCode(surrogate1, surrogate2);
          }
          return String.fromCharCode(c);
        }
        __name(fromCodePoint, "fromCodePoint");
        var UNESCAPE_MD_RE = /\\([!"#$%&'()*+,\-.\/:;<=>?@[\\\]^_`{|}~])/g;
        var ENTITY_RE = /&([a-z#][a-z0-9]{1,31});/gi;
        var UNESCAPE_ALL_RE = new RegExp(UNESCAPE_MD_RE.source + "|" + ENTITY_RE.source, "gi");
        var DIGITAL_ENTITY_TEST_RE = /^#((?:x[a-f0-9]{1,8}|[0-9]{1,8}))/i;
        var entities = require_entities2();
        function replaceEntityPattern(match2, name) {
          var code2 = 0;
          if (has(entities, name)) {
            return entities[name];
          }
          if (name.charCodeAt(0) === 35 && DIGITAL_ENTITY_TEST_RE.test(name)) {
            code2 = name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
            if (isValidEntityCode(code2)) {
              return fromCodePoint(code2);
            }
          }
          return match2;
        }
        __name(replaceEntityPattern, "replaceEntityPattern");
        function unescapeMd(str) {
          if (str.indexOf("\\") < 0) {
            return str;
          }
          return str.replace(UNESCAPE_MD_RE, "$1");
        }
        __name(unescapeMd, "unescapeMd");
        function unescapeAll(str) {
          if (str.indexOf("\\") < 0 && str.indexOf("&") < 0) {
            return str;
          }
          return str.replace(UNESCAPE_ALL_RE, function(match2, escaped, entity) {
            if (escaped) {
              return escaped;
            }
            return replaceEntityPattern(match2, entity);
          });
        }
        __name(unescapeAll, "unescapeAll");
        var HTML_ESCAPE_TEST_RE = /[&<>"]/;
        var HTML_ESCAPE_REPLACE_RE = /[&<>"]/g;
        var HTML_REPLACEMENTS = {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;"
        };
        function replaceUnsafeChar(ch) {
          return HTML_REPLACEMENTS[ch];
        }
        __name(replaceUnsafeChar, "replaceUnsafeChar");
        function escapeHtml22(str) {
          if (HTML_ESCAPE_TEST_RE.test(str)) {
            return str.replace(HTML_ESCAPE_REPLACE_RE, replaceUnsafeChar);
          }
          return str;
        }
        __name(escapeHtml22, "escapeHtml2");
        var REGEXP_ESCAPE_RE = /[.?*+^$[\]\\(){}|-]/g;
        function escapeRE(str) {
          return str.replace(REGEXP_ESCAPE_RE, "\\$&");
        }
        __name(escapeRE, "escapeRE");
        function isSpace(code2) {
          switch (code2) {
            case 9:
            case 32:
              return true;
          }
          return false;
        }
        __name(isSpace, "isSpace");
        function isWhiteSpace(code2) {
          if (code2 >= 8192 && code2 <= 8202) {
            return true;
          }
          switch (code2) {
            case 9:
            case 10:
            case 11:
            case 12:
            case 13:
            case 32:
            case 160:
            case 5760:
            case 8239:
            case 8287:
            case 12288:
              return true;
          }
          return false;
        }
        __name(isWhiteSpace, "isWhiteSpace");
        var UNICODE_PUNCT_RE = require_regex();
        function isPunctChar(ch) {
          return UNICODE_PUNCT_RE.test(ch);
        }
        __name(isPunctChar, "isPunctChar");
        function isMdAsciiPunct(ch) {
          switch (ch) {
            case 33:
            case 34:
            case 35:
            case 36:
            case 37:
            case 38:
            case 39:
            case 40:
            case 41:
            case 42:
            case 43:
            case 44:
            case 45:
            case 46:
            case 47:
            case 58:
            case 59:
            case 60:
            case 61:
            case 62:
            case 63:
            case 64:
            case 91:
            case 92:
            case 93:
            case 94:
            case 95:
            case 96:
            case 123:
            case 124:
            case 125:
            case 126:
              return true;
            default:
              return false;
          }
        }
        __name(isMdAsciiPunct, "isMdAsciiPunct");
        function normalizeReference(str) {
          str = str.trim().replace(/\s+/g, " ");
          if ("\u1E9E".toLowerCase() === "\u1E7E") {
            str = str.replace(/ẞ/g, "\xDF");
          }
          return str.toLowerCase().toUpperCase();
        }
        __name(normalizeReference, "normalizeReference");
        exports.lib = {};
        exports.lib.mdurl = require_mdurl();
        exports.lib.ucmicro = require_uc();
        exports.assign = assign;
        exports.isString = isString2;
        exports.has = has;
        exports.unescapeMd = unescapeMd;
        exports.unescapeAll = unescapeAll;
        exports.isValidEntityCode = isValidEntityCode;
        exports.fromCodePoint = fromCodePoint;
        exports.escapeHtml = escapeHtml22;
        exports.arrayReplaceAt = arrayReplaceAt;
        exports.isSpace = isSpace;
        exports.isWhiteSpace = isWhiteSpace;
        exports.isMdAsciiPunct = isMdAsciiPunct;
        exports.isPunctChar = isPunctChar;
        exports.escapeRE = escapeRE;
        exports.normalizeReference = normalizeReference;
      }
    });
    require_parse_link_label = __commonJS2({
      "node_modules/markdown-it/lib/helpers/parse_link_label.js"(exports, module) {
        "use strict";
        module.exports = /* @__PURE__ */ __name(function parseLinkLabel(state, start, disableNested) {
          var level, found, marker, prevPos, labelEnd = -1, max2 = state.posMax, oldPos = state.pos;
          state.pos = start + 1;
          level = 1;
          while (state.pos < max2) {
            marker = state.src.charCodeAt(state.pos);
            if (marker === 93) {
              level--;
              if (level === 0) {
                found = true;
                break;
              }
            }
            prevPos = state.pos;
            state.md.inline.skipToken(state);
            if (marker === 91) {
              if (prevPos === state.pos - 1) {
                level++;
              } else if (disableNested) {
                state.pos = oldPos;
                return -1;
              }
            }
          }
          if (found) {
            labelEnd = state.pos;
          }
          state.pos = oldPos;
          return labelEnd;
        }, "parseLinkLabel");
      }
    });
    require_parse_link_destination = __commonJS2({
      "node_modules/markdown-it/lib/helpers/parse_link_destination.js"(exports, module) {
        "use strict";
        var unescapeAll = require_utils().unescapeAll;
        module.exports = /* @__PURE__ */ __name(function parseLinkDestination(str, pos, max2) {
          var code2, level, lines = 0, start = pos, result = {
            ok: false,
            pos: 0,
            lines: 0,
            str: ""
          };
          if (str.charCodeAt(pos) === 60) {
            pos++;
            while (pos < max2) {
              code2 = str.charCodeAt(pos);
              if (code2 === 10) {
                return result;
              }
              if (code2 === 60) {
                return result;
              }
              if (code2 === 62) {
                result.pos = pos + 1;
                result.str = unescapeAll(str.slice(start + 1, pos));
                result.ok = true;
                return result;
              }
              if (code2 === 92 && pos + 1 < max2) {
                pos += 2;
                continue;
              }
              pos++;
            }
            return result;
          }
          level = 0;
          while (pos < max2) {
            code2 = str.charCodeAt(pos);
            if (code2 === 32) {
              break;
            }
            if (code2 < 32 || code2 === 127) {
              break;
            }
            if (code2 === 92 && pos + 1 < max2) {
              if (str.charCodeAt(pos + 1) === 32) {
                break;
              }
              pos += 2;
              continue;
            }
            if (code2 === 40) {
              level++;
              if (level > 32) {
                return result;
              }
            }
            if (code2 === 41) {
              if (level === 0) {
                break;
              }
              level--;
            }
            pos++;
          }
          if (start === pos) {
            return result;
          }
          if (level !== 0) {
            return result;
          }
          result.str = unescapeAll(str.slice(start, pos));
          result.lines = lines;
          result.pos = pos;
          result.ok = true;
          return result;
        }, "parseLinkDestination");
      }
    });
    require_parse_link_title = __commonJS2({
      "node_modules/markdown-it/lib/helpers/parse_link_title.js"(exports, module) {
        "use strict";
        var unescapeAll = require_utils().unescapeAll;
        module.exports = /* @__PURE__ */ __name(function parseLinkTitle(str, pos, max2) {
          var code2, marker, lines = 0, start = pos, result = {
            ok: false,
            pos: 0,
            lines: 0,
            str: ""
          };
          if (pos >= max2) {
            return result;
          }
          marker = str.charCodeAt(pos);
          if (marker !== 34 && marker !== 39 && marker !== 40) {
            return result;
          }
          pos++;
          if (marker === 40) {
            marker = 41;
          }
          while (pos < max2) {
            code2 = str.charCodeAt(pos);
            if (code2 === marker) {
              result.pos = pos + 1;
              result.lines = lines;
              result.str = unescapeAll(str.slice(start + 1, pos));
              result.ok = true;
              return result;
            } else if (code2 === 40 && marker === 41) {
              return result;
            } else if (code2 === 10) {
              lines++;
            } else if (code2 === 92 && pos + 1 < max2) {
              pos++;
              if (str.charCodeAt(pos) === 10) {
                lines++;
              }
            }
            pos++;
          }
          return result;
        }, "parseLinkTitle");
      }
    });
    require_helpers = __commonJS2({
      "node_modules/markdown-it/lib/helpers/index.js"(exports) {
        "use strict";
        exports.parseLinkLabel = require_parse_link_label();
        exports.parseLinkDestination = require_parse_link_destination();
        exports.parseLinkTitle = require_parse_link_title();
      }
    });
    require_renderer = __commonJS2({
      "node_modules/markdown-it/lib/renderer.js"(exports, module) {
        "use strict";
        var assign = require_utils().assign;
        var unescapeAll = require_utils().unescapeAll;
        var escapeHtml22 = require_utils().escapeHtml;
        var default_rules = {};
        default_rules.code_inline = function(tokens, idx, options, env, slf) {
          var token = tokens[idx];
          return "<code" + slf.renderAttrs(token) + ">" + escapeHtml22(tokens[idx].content) + "</code>";
        };
        default_rules.code_block = function(tokens, idx, options, env, slf) {
          var token = tokens[idx];
          return "<pre" + slf.renderAttrs(token) + "><code>" + escapeHtml22(tokens[idx].content) + "</code></pre>\n";
        };
        default_rules.fence = function(tokens, idx, options, env, slf) {
          var token = tokens[idx], info = token.info ? unescapeAll(token.info).trim() : "", langName = "", langAttrs = "", highlighted, i, arr, tmpAttrs, tmpToken;
          if (info) {
            arr = info.split(/(\s+)/g);
            langName = arr[0];
            langAttrs = arr.slice(2).join("");
          }
          if (options.highlight) {
            highlighted = options.highlight(token.content, langName, langAttrs) || escapeHtml22(token.content);
          } else {
            highlighted = escapeHtml22(token.content);
          }
          if (highlighted.indexOf("<pre") === 0) {
            return highlighted + "\n";
          }
          if (info) {
            i = token.attrIndex("class");
            tmpAttrs = token.attrs ? token.attrs.slice() : [];
            if (i < 0) {
              tmpAttrs.push(["class", options.langPrefix + langName]);
            } else {
              tmpAttrs[i] = tmpAttrs[i].slice();
              tmpAttrs[i][1] += " " + options.langPrefix + langName;
            }
            tmpToken = {
              attrs: tmpAttrs
            };
            return "<pre><code" + slf.renderAttrs(tmpToken) + ">" + highlighted + "</code></pre>\n";
          }
          return "<pre><code" + slf.renderAttrs(token) + ">" + highlighted + "</code></pre>\n";
        };
        default_rules.image = function(tokens, idx, options, env, slf) {
          var token = tokens[idx];
          token.attrs[token.attrIndex("alt")][1] = slf.renderInlineAsText(token.children, options, env);
          return slf.renderToken(tokens, idx, options);
        };
        default_rules.hardbreak = function(tokens, idx, options) {
          return options.xhtmlOut ? "<br />\n" : "<br>\n";
        };
        default_rules.softbreak = function(tokens, idx, options) {
          return options.breaks ? options.xhtmlOut ? "<br />\n" : "<br>\n" : "\n";
        };
        default_rules.text = function(tokens, idx) {
          return escapeHtml22(tokens[idx].content);
        };
        default_rules.html_block = function(tokens, idx) {
          return tokens[idx].content;
        };
        default_rules.html_inline = function(tokens, idx) {
          return tokens[idx].content;
        };
        function Renderer() {
          this.rules = assign({}, default_rules);
        }
        __name(Renderer, "Renderer");
        Renderer.prototype.renderAttrs = /* @__PURE__ */ __name(function renderAttrs(token) {
          var i, l, result;
          if (!token.attrs) {
            return "";
          }
          result = "";
          for (i = 0, l = token.attrs.length; i < l; i++) {
            result += " " + escapeHtml22(token.attrs[i][0]) + '="' + escapeHtml22(token.attrs[i][1]) + '"';
          }
          return result;
        }, "renderAttrs");
        Renderer.prototype.renderToken = /* @__PURE__ */ __name(function renderToken(tokens, idx, options) {
          var nextToken, result = "", needLf = false, token = tokens[idx];
          if (token.hidden) {
            return "";
          }
          if (token.block && token.nesting !== -1 && idx && tokens[idx - 1].hidden) {
            result += "\n";
          }
          result += (token.nesting === -1 ? "</" : "<") + token.tag;
          result += this.renderAttrs(token);
          if (token.nesting === 0 && options.xhtmlOut) {
            result += " /";
          }
          if (token.block) {
            needLf = true;
            if (token.nesting === 1) {
              if (idx + 1 < tokens.length) {
                nextToken = tokens[idx + 1];
                if (nextToken.type === "inline" || nextToken.hidden) {
                  needLf = false;
                } else if (nextToken.nesting === -1 && nextToken.tag === token.tag) {
                  needLf = false;
                }
              }
            }
          }
          result += needLf ? ">\n" : ">";
          return result;
        }, "renderToken");
        Renderer.prototype.renderInline = function(tokens, options, env) {
          var type2, result = "", rules = this.rules;
          for (var i = 0, len = tokens.length; i < len; i++) {
            type2 = tokens[i].type;
            if (typeof rules[type2] !== "undefined") {
              result += rules[type2](tokens, i, options, env, this);
            } else {
              result += this.renderToken(tokens, i, options);
            }
          }
          return result;
        };
        Renderer.prototype.renderInlineAsText = function(tokens, options, env) {
          var result = "";
          for (var i = 0, len = tokens.length; i < len; i++) {
            if (tokens[i].type === "text") {
              result += tokens[i].content;
            } else if (tokens[i].type === "image") {
              result += this.renderInlineAsText(tokens[i].children, options, env);
            } else if (tokens[i].type === "softbreak") {
              result += "\n";
            }
          }
          return result;
        };
        Renderer.prototype.render = function(tokens, options, env) {
          var i, len, type2, result = "", rules = this.rules;
          for (i = 0, len = tokens.length; i < len; i++) {
            type2 = tokens[i].type;
            if (type2 === "inline") {
              result += this.renderInline(tokens[i].children, options, env);
            } else if (typeof rules[type2] !== "undefined") {
              result += rules[tokens[i].type](tokens, i, options, env, this);
            } else {
              result += this.renderToken(tokens, i, options, env);
            }
          }
          return result;
        };
        module.exports = Renderer;
      }
    });
    require_ruler = __commonJS2({
      "node_modules/markdown-it/lib/ruler.js"(exports, module) {
        "use strict";
        function Ruler() {
          this.__rules__ = [];
          this.__cache__ = null;
        }
        __name(Ruler, "Ruler");
        Ruler.prototype.__find__ = function(name) {
          for (var i = 0; i < this.__rules__.length; i++) {
            if (this.__rules__[i].name === name) {
              return i;
            }
          }
          return -1;
        };
        Ruler.prototype.__compile__ = function() {
          var self = this;
          var chains = [""];
          self.__rules__.forEach(function(rule) {
            if (!rule.enabled) {
              return;
            }
            rule.alt.forEach(function(altName) {
              if (chains.indexOf(altName) < 0) {
                chains.push(altName);
              }
            });
          });
          self.__cache__ = {};
          chains.forEach(function(chain) {
            self.__cache__[chain] = [];
            self.__rules__.forEach(function(rule) {
              if (!rule.enabled) {
                return;
              }
              if (chain && rule.alt.indexOf(chain) < 0) {
                return;
              }
              self.__cache__[chain].push(rule.fn);
            });
          });
        };
        Ruler.prototype.at = function(name, fn, options) {
          var index2 = this.__find__(name);
          var opt = options || {};
          if (index2 === -1) {
            throw new Error("Parser rule not found: " + name);
          }
          this.__rules__[index2].fn = fn;
          this.__rules__[index2].alt = opt.alt || [];
          this.__cache__ = null;
        };
        Ruler.prototype.before = function(beforeName, ruleName, fn, options) {
          var index2 = this.__find__(beforeName);
          var opt = options || {};
          if (index2 === -1) {
            throw new Error("Parser rule not found: " + beforeName);
          }
          this.__rules__.splice(index2, 0, {
            name: ruleName,
            enabled: true,
            fn,
            alt: opt.alt || []
          });
          this.__cache__ = null;
        };
        Ruler.prototype.after = function(afterName, ruleName, fn, options) {
          var index2 = this.__find__(afterName);
          var opt = options || {};
          if (index2 === -1) {
            throw new Error("Parser rule not found: " + afterName);
          }
          this.__rules__.splice(index2 + 1, 0, {
            name: ruleName,
            enabled: true,
            fn,
            alt: opt.alt || []
          });
          this.__cache__ = null;
        };
        Ruler.prototype.push = function(ruleName, fn, options) {
          var opt = options || {};
          this.__rules__.push({
            name: ruleName,
            enabled: true,
            fn,
            alt: opt.alt || []
          });
          this.__cache__ = null;
        };
        Ruler.prototype.enable = function(list2, ignoreInvalid) {
          if (!Array.isArray(list2)) {
            list2 = [list2];
          }
          var result = [];
          list2.forEach(function(name) {
            var idx = this.__find__(name);
            if (idx < 0) {
              if (ignoreInvalid) {
                return;
              }
              throw new Error("Rules manager: invalid rule name " + name);
            }
            this.__rules__[idx].enabled = true;
            result.push(name);
          }, this);
          this.__cache__ = null;
          return result;
        };
        Ruler.prototype.enableOnly = function(list2, ignoreInvalid) {
          if (!Array.isArray(list2)) {
            list2 = [list2];
          }
          this.__rules__.forEach(function(rule) {
            rule.enabled = false;
          });
          this.enable(list2, ignoreInvalid);
        };
        Ruler.prototype.disable = function(list2, ignoreInvalid) {
          if (!Array.isArray(list2)) {
            list2 = [list2];
          }
          var result = [];
          list2.forEach(function(name) {
            var idx = this.__find__(name);
            if (idx < 0) {
              if (ignoreInvalid) {
                return;
              }
              throw new Error("Rules manager: invalid rule name " + name);
            }
            this.__rules__[idx].enabled = false;
            result.push(name);
          }, this);
          this.__cache__ = null;
          return result;
        };
        Ruler.prototype.getRules = function(chainName) {
          if (this.__cache__ === null) {
            this.__compile__();
          }
          return this.__cache__[chainName] || [];
        };
        module.exports = Ruler;
      }
    });
    require_normalize = __commonJS2({
      "node_modules/markdown-it/lib/rules_core/normalize.js"(exports, module) {
        "use strict";
        var NEWLINES_RE = /\r\n?|\n/g;
        var NULL_RE = /\0/g;
        module.exports = /* @__PURE__ */ __name(function normalize(state) {
          var str;
          str = state.src.replace(NEWLINES_RE, "\n");
          str = str.replace(NULL_RE, "\uFFFD");
          state.src = str;
        }, "normalize");
      }
    });
    require_block = __commonJS2({
      "node_modules/markdown-it/lib/rules_core/block.js"(exports, module) {
        "use strict";
        module.exports = /* @__PURE__ */ __name(function block4(state) {
          var token;
          if (state.inlineMode) {
            token = new state.Token("inline", "", 0);
            token.content = state.src;
            token.map = [0, 1];
            token.children = [];
            state.tokens.push(token);
          } else {
            state.md.block.parse(state.src, state.md, state.env, state.tokens);
          }
        }, "block4");
      }
    });
    require_inline = __commonJS2({
      "node_modules/markdown-it/lib/rules_core/inline.js"(exports, module) {
        "use strict";
        module.exports = /* @__PURE__ */ __name(function inline4(state) {
          var tokens = state.tokens, tok, i, l;
          for (i = 0, l = tokens.length; i < l; i++) {
            tok = tokens[i];
            if (tok.type === "inline") {
              state.md.inline.parse(tok.content, state.md, state.env, tok.children);
            }
          }
        }, "inline4");
      }
    });
    require_linkify = __commonJS2({
      "node_modules/markdown-it/lib/rules_core/linkify.js"(exports, module) {
        "use strict";
        var arrayReplaceAt = require_utils().arrayReplaceAt;
        function isLinkOpen(str) {
          return /^<a[>\s]/i.test(str);
        }
        __name(isLinkOpen, "isLinkOpen");
        function isLinkClose(str) {
          return /^<\/a\s*>/i.test(str);
        }
        __name(isLinkClose, "isLinkClose");
        module.exports = /* @__PURE__ */ __name(function linkify(state) {
          var i, j, l, tokens, token, currentToken, nodes, ln, text22, pos, lastPos, level, htmlLinkLevel, url2, fullUrl, urlText, blockTokens = state.tokens, links;
          if (!state.md.options.linkify) {
            return;
          }
          for (j = 0, l = blockTokens.length; j < l; j++) {
            if (blockTokens[j].type !== "inline" || !state.md.linkify.pretest(blockTokens[j].content)) {
              continue;
            }
            tokens = blockTokens[j].children;
            htmlLinkLevel = 0;
            for (i = tokens.length - 1; i >= 0; i--) {
              currentToken = tokens[i];
              if (currentToken.type === "link_close") {
                i--;
                while (tokens[i].level !== currentToken.level && tokens[i].type !== "link_open") {
                  i--;
                }
                continue;
              }
              if (currentToken.type === "html_inline") {
                if (isLinkOpen(currentToken.content) && htmlLinkLevel > 0) {
                  htmlLinkLevel--;
                }
                if (isLinkClose(currentToken.content)) {
                  htmlLinkLevel++;
                }
              }
              if (htmlLinkLevel > 0) {
                continue;
              }
              if (currentToken.type === "text" && state.md.linkify.test(currentToken.content)) {
                text22 = currentToken.content;
                links = state.md.linkify.match(text22);
                nodes = [];
                level = currentToken.level;
                lastPos = 0;
                for (ln = 0; ln < links.length; ln++) {
                  url2 = links[ln].url;
                  fullUrl = state.md.normalizeLink(url2);
                  if (!state.md.validateLink(fullUrl)) {
                    continue;
                  }
                  urlText = links[ln].text;
                  if (!links[ln].schema) {
                    urlText = state.md.normalizeLinkText("http://" + urlText).replace(/^http:\/\//, "");
                  } else if (links[ln].schema === "mailto:" && !/^mailto:/i.test(urlText)) {
                    urlText = state.md.normalizeLinkText("mailto:" + urlText).replace(/^mailto:/, "");
                  } else {
                    urlText = state.md.normalizeLinkText(urlText);
                  }
                  pos = links[ln].index;
                  if (pos > lastPos) {
                    token = new state.Token("text", "", 0);
                    token.content = text22.slice(lastPos, pos);
                    token.level = level;
                    nodes.push(token);
                  }
                  token = new state.Token("link_open", "a", 1);
                  token.attrs = [["href", fullUrl]];
                  token.level = level++;
                  token.markup = "linkify";
                  token.info = "auto";
                  nodes.push(token);
                  token = new state.Token("text", "", 0);
                  token.content = urlText;
                  token.level = level;
                  nodes.push(token);
                  token = new state.Token("link_close", "a", -1);
                  token.level = --level;
                  token.markup = "linkify";
                  token.info = "auto";
                  nodes.push(token);
                  lastPos = links[ln].lastIndex;
                }
                if (lastPos < text22.length) {
                  token = new state.Token("text", "", 0);
                  token.content = text22.slice(lastPos);
                  token.level = level;
                  nodes.push(token);
                }
                blockTokens[j].children = tokens = arrayReplaceAt(tokens, i, nodes);
              }
            }
          }
        }, "linkify");
      }
    });
    require_replacements = __commonJS2({
      "node_modules/markdown-it/lib/rules_core/replacements.js"(exports, module) {
        "use strict";
        var RARE_RE = /\+-|\.\.|\?\?\?\?|!!!!|,,|--/;
        var SCOPED_ABBR_TEST_RE = /\((c|tm|r|p)\)/i;
        var SCOPED_ABBR_RE = /\((c|tm|r|p)\)/ig;
        var SCOPED_ABBR = {
          c: "\xA9",
          r: "\xAE",
          p: "\xA7",
          tm: "\u2122"
        };
        function replaceFn(match2, name) {
          return SCOPED_ABBR[name.toLowerCase()];
        }
        __name(replaceFn, "replaceFn");
        function replace_scoped(inlineTokens) {
          var i, token, inside_autolink = 0;
          for (i = inlineTokens.length - 1; i >= 0; i--) {
            token = inlineTokens[i];
            if (token.type === "text" && !inside_autolink) {
              token.content = token.content.replace(SCOPED_ABBR_RE, replaceFn);
            }
            if (token.type === "link_open" && token.info === "auto") {
              inside_autolink--;
            }
            if (token.type === "link_close" && token.info === "auto") {
              inside_autolink++;
            }
          }
        }
        __name(replace_scoped, "replace_scoped");
        function replace_rare(inlineTokens) {
          var i, token, inside_autolink = 0;
          for (i = inlineTokens.length - 1; i >= 0; i--) {
            token = inlineTokens[i];
            if (token.type === "text" && !inside_autolink) {
              if (RARE_RE.test(token.content)) {
                token.content = token.content.replace(/\+-/g, "\xB1").replace(/\.{2,}/g, "\u2026").replace(/([?!])…/g, "$1..").replace(/([?!]){4,}/g, "$1$1$1").replace(/,{2,}/g, ",").replace(/(^|[^-])---(?=[^-]|$)/mg, "$1\u2014").replace(/(^|\s)--(?=\s|$)/mg, "$1\u2013").replace(/(^|[^-\s])--(?=[^-\s]|$)/mg, "$1\u2013");
              }
            }
            if (token.type === "link_open" && token.info === "auto") {
              inside_autolink--;
            }
            if (token.type === "link_close" && token.info === "auto") {
              inside_autolink++;
            }
          }
        }
        __name(replace_rare, "replace_rare");
        module.exports = /* @__PURE__ */ __name(function replace(state) {
          var blkIdx;
          if (!state.md.options.typographer) {
            return;
          }
          for (blkIdx = state.tokens.length - 1; blkIdx >= 0; blkIdx--) {
            if (state.tokens[blkIdx].type !== "inline") {
              continue;
            }
            if (SCOPED_ABBR_TEST_RE.test(state.tokens[blkIdx].content)) {
              replace_scoped(state.tokens[blkIdx].children);
            }
            if (RARE_RE.test(state.tokens[blkIdx].content)) {
              replace_rare(state.tokens[blkIdx].children);
            }
          }
        }, "replace");
      }
    });
    require_smartquotes = __commonJS2({
      "node_modules/markdown-it/lib/rules_core/smartquotes.js"(exports, module) {
        "use strict";
        var isWhiteSpace = require_utils().isWhiteSpace;
        var isPunctChar = require_utils().isPunctChar;
        var isMdAsciiPunct = require_utils().isMdAsciiPunct;
        var QUOTE_TEST_RE = /['"]/;
        var QUOTE_RE = /['"]/g;
        var APOSTROPHE = "\u2019";
        function replaceAt(str, index2, ch) {
          return str.substr(0, index2) + ch + str.substr(index2 + 1);
        }
        __name(replaceAt, "replaceAt");
        function process_inlines(tokens, state) {
          var i, token, text22, t, pos, max2, thisLevel, item2, lastChar, nextChar, isLastPunctChar, isNextPunctChar, isLastWhiteSpace, isNextWhiteSpace, canOpen, canClose, j, isSingle, stack, openQuote, closeQuote;
          stack = [];
          for (i = 0; i < tokens.length; i++) {
            token = tokens[i];
            thisLevel = tokens[i].level;
            for (j = stack.length - 1; j >= 0; j--) {
              if (stack[j].level <= thisLevel) {
                break;
              }
            }
            stack.length = j + 1;
            if (token.type !== "text") {
              continue;
            }
            text22 = token.content;
            pos = 0;
            max2 = text22.length;
            OUTER:
              while (pos < max2) {
                QUOTE_RE.lastIndex = pos;
                t = QUOTE_RE.exec(text22);
                if (!t) {
                  break;
                }
                canOpen = canClose = true;
                pos = t.index + 1;
                isSingle = t[0] === "'";
                lastChar = 32;
                if (t.index - 1 >= 0) {
                  lastChar = text22.charCodeAt(t.index - 1);
                } else {
                  for (j = i - 1; j >= 0; j--) {
                    if (tokens[j].type === "softbreak" || tokens[j].type === "hardbreak")
                      break;
                    if (!tokens[j].content)
                      continue;
                    lastChar = tokens[j].content.charCodeAt(tokens[j].content.length - 1);
                    break;
                  }
                }
                nextChar = 32;
                if (pos < max2) {
                  nextChar = text22.charCodeAt(pos);
                } else {
                  for (j = i + 1; j < tokens.length; j++) {
                    if (tokens[j].type === "softbreak" || tokens[j].type === "hardbreak")
                      break;
                    if (!tokens[j].content)
                      continue;
                    nextChar = tokens[j].content.charCodeAt(0);
                    break;
                  }
                }
                isLastPunctChar = isMdAsciiPunct(lastChar) || isPunctChar(String.fromCharCode(lastChar));
                isNextPunctChar = isMdAsciiPunct(nextChar) || isPunctChar(String.fromCharCode(nextChar));
                isLastWhiteSpace = isWhiteSpace(lastChar);
                isNextWhiteSpace = isWhiteSpace(nextChar);
                if (isNextWhiteSpace) {
                  canOpen = false;
                } else if (isNextPunctChar) {
                  if (!(isLastWhiteSpace || isLastPunctChar)) {
                    canOpen = false;
                  }
                }
                if (isLastWhiteSpace) {
                  canClose = false;
                } else if (isLastPunctChar) {
                  if (!(isNextWhiteSpace || isNextPunctChar)) {
                    canClose = false;
                  }
                }
                if (nextChar === 34 && t[0] === '"') {
                  if (lastChar >= 48 && lastChar <= 57) {
                    canClose = canOpen = false;
                  }
                }
                if (canOpen && canClose) {
                  canOpen = isLastPunctChar;
                  canClose = isNextPunctChar;
                }
                if (!canOpen && !canClose) {
                  if (isSingle) {
                    token.content = replaceAt(token.content, t.index, APOSTROPHE);
                  }
                  continue;
                }
                if (canClose) {
                  for (j = stack.length - 1; j >= 0; j--) {
                    item2 = stack[j];
                    if (stack[j].level < thisLevel) {
                      break;
                    }
                    if (item2.single === isSingle && stack[j].level === thisLevel) {
                      item2 = stack[j];
                      if (isSingle) {
                        openQuote = state.md.options.quotes[2];
                        closeQuote = state.md.options.quotes[3];
                      } else {
                        openQuote = state.md.options.quotes[0];
                        closeQuote = state.md.options.quotes[1];
                      }
                      token.content = replaceAt(token.content, t.index, closeQuote);
                      tokens[item2.token].content = replaceAt(tokens[item2.token].content, item2.pos, openQuote);
                      pos += closeQuote.length - 1;
                      if (item2.token === i) {
                        pos += openQuote.length - 1;
                      }
                      text22 = token.content;
                      max2 = text22.length;
                      stack.length = j;
                      continue OUTER;
                    }
                  }
                }
                if (canOpen) {
                  stack.push({
                    token: i,
                    pos: t.index,
                    single: isSingle,
                    level: thisLevel
                  });
                } else if (canClose && isSingle) {
                  token.content = replaceAt(token.content, t.index, APOSTROPHE);
                }
              }
          }
        }
        __name(process_inlines, "process_inlines");
        module.exports = /* @__PURE__ */ __name(function smartquotes(state) {
          var blkIdx;
          if (!state.md.options.typographer) {
            return;
          }
          for (blkIdx = state.tokens.length - 1; blkIdx >= 0; blkIdx--) {
            if (state.tokens[blkIdx].type !== "inline" || !QUOTE_TEST_RE.test(state.tokens[blkIdx].content)) {
              continue;
            }
            process_inlines(state.tokens[blkIdx].children, state);
          }
        }, "smartquotes");
      }
    });
    require_token = __commonJS2({
      "node_modules/markdown-it/lib/token.js"(exports, module) {
        "use strict";
        function Token(type2, tag, nesting) {
          this.type = type2;
          this.tag = tag;
          this.attrs = null;
          this.map = null;
          this.nesting = nesting;
          this.level = 0;
          this.children = null;
          this.content = "";
          this.markup = "";
          this.info = "";
          this.meta = null;
          this.block = false;
          this.hidden = false;
        }
        __name(Token, "Token");
        Token.prototype.attrIndex = /* @__PURE__ */ __name(function attrIndex(name) {
          var attrs, i, len;
          if (!this.attrs) {
            return -1;
          }
          attrs = this.attrs;
          for (i = 0, len = attrs.length; i < len; i++) {
            if (attrs[i][0] === name) {
              return i;
            }
          }
          return -1;
        }, "attrIndex");
        Token.prototype.attrPush = /* @__PURE__ */ __name(function attrPush(attrData) {
          if (this.attrs) {
            this.attrs.push(attrData);
          } else {
            this.attrs = [attrData];
          }
        }, "attrPush");
        Token.prototype.attrSet = /* @__PURE__ */ __name(function attrSet(name, value) {
          var idx = this.attrIndex(name), attrData = [name, value];
          if (idx < 0) {
            this.attrPush(attrData);
          } else {
            this.attrs[idx] = attrData;
          }
        }, "attrSet");
        Token.prototype.attrGet = /* @__PURE__ */ __name(function attrGet(name) {
          var idx = this.attrIndex(name), value = null;
          if (idx >= 0) {
            value = this.attrs[idx][1];
          }
          return value;
        }, "attrGet");
        Token.prototype.attrJoin = /* @__PURE__ */ __name(function attrJoin(name, value) {
          var idx = this.attrIndex(name);
          if (idx < 0) {
            this.attrPush([name, value]);
          } else {
            this.attrs[idx][1] = this.attrs[idx][1] + " " + value;
          }
        }, "attrJoin");
        module.exports = Token;
      }
    });
    require_state_core = __commonJS2({
      "node_modules/markdown-it/lib/rules_core/state_core.js"(exports, module) {
        "use strict";
        var Token = require_token();
        function StateCore(src, md, env) {
          this.src = src;
          this.env = env;
          this.tokens = [];
          this.inlineMode = false;
          this.md = md;
        }
        __name(StateCore, "StateCore");
        StateCore.prototype.Token = Token;
        module.exports = StateCore;
      }
    });
    require_parser_core = __commonJS2({
      "node_modules/markdown-it/lib/parser_core.js"(exports, module) {
        "use strict";
        var Ruler = require_ruler();
        var _rules = [
          ["normalize", require_normalize()],
          ["block", require_block()],
          ["inline", require_inline()],
          ["linkify", require_linkify()],
          ["replacements", require_replacements()],
          ["smartquotes", require_smartquotes()]
        ];
        function Core() {
          this.ruler = new Ruler();
          for (var i = 0; i < _rules.length; i++) {
            this.ruler.push(_rules[i][0], _rules[i][1]);
          }
        }
        __name(Core, "Core");
        Core.prototype.process = function(state) {
          var i, l, rules;
          rules = this.ruler.getRules("");
          for (i = 0, l = rules.length; i < l; i++) {
            rules[i](state);
          }
        };
        Core.prototype.State = require_state_core();
        module.exports = Core;
      }
    });
    require_table = __commonJS2({
      "node_modules/markdown-it/lib/rules_block/table.js"(exports, module) {
        "use strict";
        var isSpace = require_utils().isSpace;
        function getLine2(state, line) {
          var pos = state.bMarks[line] + state.tShift[line], max2 = state.eMarks[line];
          return state.src.substr(pos, max2 - pos);
        }
        __name(getLine2, "getLine2");
        function escapedSplit(str) {
          var result = [], pos = 0, max2 = str.length, ch, isEscaped = false, lastPos = 0, current = "";
          ch = str.charCodeAt(pos);
          while (pos < max2) {
            if (ch === 124) {
              if (!isEscaped) {
                result.push(current + str.substring(lastPos, pos));
                current = "";
                lastPos = pos + 1;
              } else {
                current += str.substring(lastPos, pos - 1);
                lastPos = pos;
              }
            }
            isEscaped = ch === 92;
            pos++;
            ch = str.charCodeAt(pos);
          }
          result.push(current + str.substring(lastPos));
          return result;
        }
        __name(escapedSplit, "escapedSplit");
        module.exports = /* @__PURE__ */ __name(function table3(state, startLine, endLine, silent) {
          var ch, lineText, pos, i, l, nextLine, columns, columnCount, token, aligns, t, tableLines, tbodyLines, oldParentType, terminate, terminatorRules, firstCh, secondCh;
          if (startLine + 2 > endLine) {
            return false;
          }
          nextLine = startLine + 1;
          if (state.sCount[nextLine] < state.blkIndent) {
            return false;
          }
          if (!state.md.options.allowIndentation && state.sCount[nextLine] - state.blkIndent >= 4) {
            return false;
          }
          pos = state.bMarks[nextLine] + state.tShift[nextLine];
          if (pos >= state.eMarks[nextLine]) {
            return false;
          }
          firstCh = state.src.charCodeAt(pos++);
          if (firstCh !== 124 && firstCh !== 45 && firstCh !== 58) {
            return false;
          }
          if (pos >= state.eMarks[nextLine]) {
            return false;
          }
          secondCh = state.src.charCodeAt(pos++);
          if (secondCh !== 124 && secondCh !== 45 && secondCh !== 58 && !isSpace(secondCh)) {
            return false;
          }
          if (firstCh === 45 && isSpace(secondCh)) {
            return false;
          }
          while (pos < state.eMarks[nextLine]) {
            ch = state.src.charCodeAt(pos);
            if (ch !== 124 && ch !== 45 && ch !== 58 && !isSpace(ch)) {
              return false;
            }
            pos++;
          }
          lineText = getLine2(state, startLine + 1);
          columns = lineText.split("|");
          aligns = [];
          for (i = 0; i < columns.length; i++) {
            t = columns[i].trim();
            if (!t) {
              if (i === 0 || i === columns.length - 1) {
                continue;
              } else {
                return false;
              }
            }
            if (!/^:?-+:?$/.test(t)) {
              return false;
            }
            if (t.charCodeAt(t.length - 1) === 58) {
              aligns.push(t.charCodeAt(0) === 58 ? "center" : "right");
            } else if (t.charCodeAt(0) === 58) {
              aligns.push("left");
            } else {
              aligns.push("");
            }
          }
          lineText = getLine2(state, startLine).trim();
          if (lineText.indexOf("|") === -1) {
            return false;
          }
          if (!state.md.options.allowIndentation && state.sCount[startLine] - state.blkIndent >= 4) {
            return false;
          }
          columns = escapedSplit(lineText);
          if (columns.length && columns[0] === "")
            columns.shift();
          if (columns.length && columns[columns.length - 1] === "")
            columns.pop();
          columnCount = columns.length;
          if (columnCount === 0 || columnCount !== aligns.length) {
            return false;
          }
          if (silent) {
            return true;
          }
          oldParentType = state.parentType;
          state.parentType = "table";
          terminatorRules = state.md.block.ruler.getRules("blockquote");
          token = state.push("table_open", "table", 1);
          token.map = tableLines = [startLine, 0];
          token = state.push("thead_open", "thead", 1);
          token.map = [startLine, startLine + 1];
          token = state.push("tr_open", "tr", 1);
          token.map = [startLine, startLine + 1];
          for (i = 0; i < columns.length; i++) {
            token = state.push("th_open", "th", 1);
            if (aligns[i]) {
              token.attrs = [["style", "text-align:" + aligns[i]]];
            }
            token = state.push("inline", "", 0);
            token.content = columns[i].trim();
            token.children = [];
            token = state.push("th_close", "th", -1);
          }
          token = state.push("tr_close", "tr", -1);
          token = state.push("thead_close", "thead", -1);
          for (nextLine = startLine + 2; nextLine < endLine; nextLine++) {
            if (state.sCount[nextLine] < state.blkIndent) {
              break;
            }
            terminate = false;
            for (i = 0, l = terminatorRules.length; i < l; i++) {
              if (terminatorRules[i](state, nextLine, endLine, true)) {
                terminate = true;
                break;
              }
            }
            if (terminate) {
              break;
            }
            lineText = getLine2(state, nextLine).trim();
            if (!lineText) {
              break;
            }
            if (!state.md.options.allowIndentation && state.sCount[nextLine] - state.blkIndent >= 4) {
              break;
            }
            columns = escapedSplit(lineText);
            if (columns.length && columns[0] === "")
              columns.shift();
            if (columns.length && columns[columns.length - 1] === "")
              columns.pop();
            if (nextLine === startLine + 2) {
              token = state.push("tbody_open", "tbody", 1);
              token.map = tbodyLines = [startLine + 2, 0];
            }
            token = state.push("tr_open", "tr", 1);
            token.map = [nextLine, nextLine + 1];
            for (i = 0; i < columnCount; i++) {
              token = state.push("td_open", "td", 1);
              if (aligns[i]) {
                token.attrs = [["style", "text-align:" + aligns[i]]];
              }
              token = state.push("inline", "", 0);
              token.content = columns[i] ? columns[i].trim() : "";
              token.children = [];
              token = state.push("td_close", "td", -1);
            }
            token = state.push("tr_close", "tr", -1);
          }
          if (tbodyLines) {
            token = state.push("tbody_close", "tbody", -1);
            tbodyLines[1] = nextLine;
          }
          token = state.push("table_close", "table", -1);
          tableLines[1] = nextLine;
          state.parentType = oldParentType;
          state.line = nextLine;
          return true;
        }, "table3");
      }
    });
    require_code = __commonJS2({
      "node_modules/markdown-it/lib/rules_block/code.js"(exports, module) {
        "use strict";
        module.exports = /* @__PURE__ */ __name(function code2(state, startLine, endLine) {
          if (state.md.options.allowIndentation) {
            return false;
          }
          var nextLine, last, token;
          if (state.sCount[startLine] - state.blkIndent < 4) {
            return false;
          }
          last = nextLine = startLine + 1;
          while (nextLine < endLine) {
            if (state.isEmpty(nextLine)) {
              nextLine++;
              continue;
            }
            if (state.sCount[nextLine] - state.blkIndent >= 4) {
              nextLine++;
              last = nextLine;
              continue;
            }
            break;
          }
          state.line = last;
          token = state.push("code_block", "code", 0);
          token.content = state.getLines(startLine, last, 4 + state.blkIndent, false) + "\n";
          token.map = [startLine, state.line];
          return true;
        }, "code2");
      }
    });
    require_fence = __commonJS2({
      "node_modules/markdown-it/lib/rules_block/fence.js"(exports, module) {
        "use strict";
        module.exports = /* @__PURE__ */ __name(function fence3(state, startLine, endLine, silent) {
          var marker, len, params, nextLine, mem, token, markup, haveEndMarker = false, pos = state.bMarks[startLine] + state.tShift[startLine], max2 = state.eMarks[startLine];
          if (!state.md.options.allowIndentation && state.sCount[startLine] - state.blkIndent >= 4) {
            return false;
          }
          if (pos + 3 > max2) {
            return false;
          }
          marker = state.src.charCodeAt(pos);
          if (marker !== 126 && marker !== 96) {
            return false;
          }
          mem = pos;
          pos = state.skipChars(pos, marker);
          len = pos - mem;
          if (len < 3) {
            return false;
          }
          markup = state.src.slice(mem, pos);
          params = state.src.slice(pos, max2);
          if (marker === 96) {
            if (params.indexOf(String.fromCharCode(marker)) >= 0) {
              return false;
            }
          }
          if (silent) {
            return true;
          }
          nextLine = startLine;
          for (; ; ) {
            nextLine++;
            if (nextLine >= endLine) {
              break;
            }
            pos = mem = state.bMarks[nextLine] + state.tShift[nextLine];
            max2 = state.eMarks[nextLine];
            if (pos < max2 && state.sCount[nextLine] < state.blkIndent) {
              break;
            }
            if (state.src.charCodeAt(pos) !== marker) {
              continue;
            }
            if (!state.md.options.allowIndentation && state.sCount[nextLine] - state.blkIndent >= 4) {
              continue;
            }
            pos = state.skipChars(pos, marker);
            if (pos - mem < len) {
              continue;
            }
            pos = state.skipSpaces(pos);
            if (pos < max2) {
              continue;
            }
            haveEndMarker = true;
            break;
          }
          len = state.sCount[startLine];
          state.line = nextLine + (haveEndMarker ? 1 : 0);
          token = state.push("fence", "code", 0);
          token.info = params;
          token.content = state.getLines(startLine + 1, nextLine, len, true);
          token.markup = markup;
          token.map = [startLine, state.line];
          return true;
        }, "fence3");
      }
    });
    require_blockquote = __commonJS2({
      "node_modules/markdown-it/lib/rules_block/blockquote.js"(exports, module) {
        "use strict";
        var isSpace = require_utils().isSpace;
        module.exports = /* @__PURE__ */ __name(function blockquote2(state, startLine, endLine, silent) {
          var adjustTab, ch, i, initial, l, lastLineEmpty, lines, nextLine, offset, oldBMarks, oldBSCount, oldIndent, oldParentType, oldSCount, oldTShift, spaceAfterMarker, terminate, terminatorRules, token, isOutdented, oldLineMax = state.lineMax, pos = state.bMarks[startLine] + state.tShift[startLine], max2 = state.eMarks[startLine];
          if (!state.md.options.allowIndentation && state.sCount[startLine] - state.blkIndent >= 4) {
            return false;
          }
          if (state.src.charCodeAt(pos++) !== 62) {
            return false;
          }
          if (silent) {
            return true;
          }
          initial = offset = state.sCount[startLine] + 1;
          if (state.src.charCodeAt(pos) === 32) {
            pos++;
            initial++;
            offset++;
            adjustTab = false;
            spaceAfterMarker = true;
          } else if (state.src.charCodeAt(pos) === 9) {
            spaceAfterMarker = true;
            if ((state.bsCount[startLine] + offset) % 4 === 3) {
              pos++;
              initial++;
              offset++;
              adjustTab = false;
            } else {
              adjustTab = true;
            }
          } else {
            spaceAfterMarker = false;
          }
          oldBMarks = [state.bMarks[startLine]];
          state.bMarks[startLine] = pos;
          while (pos < max2) {
            ch = state.src.charCodeAt(pos);
            if (isSpace(ch)) {
              if (ch === 9) {
                offset += 4 - (offset + state.bsCount[startLine] + (adjustTab ? 1 : 0)) % 4;
              } else {
                offset++;
              }
            } else {
              break;
            }
            pos++;
          }
          oldBSCount = [state.bsCount[startLine]];
          state.bsCount[startLine] = state.sCount[startLine] + 1 + (spaceAfterMarker ? 1 : 0);
          lastLineEmpty = pos >= max2;
          oldSCount = [state.sCount[startLine]];
          state.sCount[startLine] = offset - initial;
          oldTShift = [state.tShift[startLine]];
          state.tShift[startLine] = pos - state.bMarks[startLine];
          terminatorRules = state.md.block.ruler.getRules("blockquote");
          oldParentType = state.parentType;
          state.parentType = "blockquote";
          for (nextLine = startLine + 1; nextLine < endLine; nextLine++) {
            isOutdented = state.sCount[nextLine] < state.blkIndent;
            pos = state.bMarks[nextLine] + state.tShift[nextLine];
            max2 = state.eMarks[nextLine];
            if (pos >= max2) {
              break;
            }
            if (state.src.charCodeAt(pos++) === 62 && !isOutdented) {
              initial = offset = state.sCount[nextLine] + 1;
              if (state.src.charCodeAt(pos) === 32) {
                pos++;
                initial++;
                offset++;
                adjustTab = false;
                spaceAfterMarker = true;
              } else if (state.src.charCodeAt(pos) === 9) {
                spaceAfterMarker = true;
                if ((state.bsCount[nextLine] + offset) % 4 === 3) {
                  pos++;
                  initial++;
                  offset++;
                  adjustTab = false;
                } else {
                  adjustTab = true;
                }
              } else {
                spaceAfterMarker = false;
              }
              oldBMarks.push(state.bMarks[nextLine]);
              state.bMarks[nextLine] = pos;
              while (pos < max2) {
                ch = state.src.charCodeAt(pos);
                if (isSpace(ch)) {
                  if (ch === 9) {
                    offset += 4 - (offset + state.bsCount[nextLine] + (adjustTab ? 1 : 0)) % 4;
                  } else {
                    offset++;
                  }
                } else {
                  break;
                }
                pos++;
              }
              lastLineEmpty = pos >= max2;
              oldBSCount.push(state.bsCount[nextLine]);
              state.bsCount[nextLine] = state.sCount[nextLine] + 1 + (spaceAfterMarker ? 1 : 0);
              oldSCount.push(state.sCount[nextLine]);
              state.sCount[nextLine] = offset - initial;
              oldTShift.push(state.tShift[nextLine]);
              state.tShift[nextLine] = pos - state.bMarks[nextLine];
              continue;
            }
            if (lastLineEmpty) {
              break;
            }
            terminate = false;
            for (i = 0, l = terminatorRules.length; i < l; i++) {
              if (terminatorRules[i](state, nextLine, endLine, true)) {
                terminate = true;
                break;
              }
            }
            if (terminate) {
              state.lineMax = nextLine;
              if (state.blkIndent !== 0) {
                oldBMarks.push(state.bMarks[nextLine]);
                oldBSCount.push(state.bsCount[nextLine]);
                oldTShift.push(state.tShift[nextLine]);
                oldSCount.push(state.sCount[nextLine]);
                state.sCount[nextLine] -= state.blkIndent;
              }
              break;
            }
            oldBMarks.push(state.bMarks[nextLine]);
            oldBSCount.push(state.bsCount[nextLine]);
            oldTShift.push(state.tShift[nextLine]);
            oldSCount.push(state.sCount[nextLine]);
            state.sCount[nextLine] = -1;
          }
          oldIndent = state.blkIndent;
          state.blkIndent = 0;
          token = state.push("blockquote_open", "blockquote", 1);
          token.markup = ">";
          token.map = lines = [startLine, 0];
          state.md.block.tokenize(state, startLine, nextLine);
          token = state.push("blockquote_close", "blockquote", -1);
          token.markup = ">";
          state.lineMax = oldLineMax;
          state.parentType = oldParentType;
          lines[1] = state.line;
          for (i = 0; i < oldTShift.length; i++) {
            state.bMarks[i + startLine] = oldBMarks[i];
            state.tShift[i + startLine] = oldTShift[i];
            state.sCount[i + startLine] = oldSCount[i];
            state.bsCount[i + startLine] = oldBSCount[i];
          }
          state.blkIndent = oldIndent;
          return true;
        }, "blockquote2");
      }
    });
    require_hr = __commonJS2({
      "node_modules/markdown-it/lib/rules_block/hr.js"(exports, module) {
        "use strict";
        var isSpace = require_utils().isSpace;
        module.exports = /* @__PURE__ */ __name(function hr2(state, startLine, endLine, silent) {
          var marker, cnt, ch, token, pos = state.bMarks[startLine] + state.tShift[startLine], max2 = state.eMarks[startLine];
          if (!state.md.options.allowIndentation && state.sCount[startLine] - state.blkIndent >= 4) {
            return false;
          }
          marker = state.src.charCodeAt(pos++);
          if (marker !== 42 && marker !== 45 && marker !== 95) {
            return false;
          }
          cnt = 1;
          while (pos < max2) {
            ch = state.src.charCodeAt(pos++);
            if (ch !== marker && !isSpace(ch)) {
              return false;
            }
            if (ch === marker) {
              cnt++;
            }
          }
          if (cnt < 3) {
            return false;
          }
          if (silent) {
            return true;
          }
          state.line = startLine + 1;
          token = state.push("hr", "hr", 0);
          token.map = [startLine, state.line];
          token.markup = Array(cnt + 1).join(String.fromCharCode(marker));
          return true;
        }, "hr2");
      }
    });
    require_list = __commonJS2({
      "node_modules/markdown-it/lib/rules_block/list.js"(exports, module) {
        "use strict";
        var isSpace = require_utils().isSpace;
        function skipBulletListMarker(state, startLine) {
          var marker, pos, max2, ch;
          pos = state.bMarks[startLine] + state.tShift[startLine];
          max2 = state.eMarks[startLine];
          marker = state.src.charCodeAt(pos++);
          if (marker !== 42 && marker !== 45 && marker !== 43) {
            return -1;
          }
          if (pos < max2) {
            ch = state.src.charCodeAt(pos);
            if (!isSpace(ch)) {
              return -1;
            }
          }
          return pos;
        }
        __name(skipBulletListMarker, "skipBulletListMarker");
        function skipOrderedListMarker(state, startLine) {
          var ch, start = state.bMarks[startLine] + state.tShift[startLine], pos = start, max2 = state.eMarks[startLine];
          if (pos + 1 >= max2) {
            return -1;
          }
          ch = state.src.charCodeAt(pos++);
          if (ch < 48 || ch > 57) {
            return -1;
          }
          for (; ; ) {
            if (pos >= max2) {
              return -1;
            }
            ch = state.src.charCodeAt(pos++);
            if (ch >= 48 && ch <= 57) {
              if (pos - start >= 10) {
                return -1;
              }
              continue;
            }
            if (ch === 41 || ch === 46) {
              break;
            }
            return -1;
          }
          if (pos < max2) {
            ch = state.src.charCodeAt(pos);
            if (!isSpace(ch)) {
              return -1;
            }
          }
          return pos;
        }
        __name(skipOrderedListMarker, "skipOrderedListMarker");
        function markTightParagraphs(state, idx) {
          var i, l, level = state.level + 2;
          for (i = idx + 2, l = state.tokens.length - 2; i < l; i++) {
            if (state.tokens[i].level === level && state.tokens[i].type === "paragraph_open") {
              state.tokens[i + 2].hidden = true;
              state.tokens[i].hidden = true;
              i += 2;
            }
          }
        }
        __name(markTightParagraphs, "markTightParagraphs");
        module.exports = /* @__PURE__ */ __name(function list2(state, startLine, endLine, silent) {
          var ch, contentStart, i, indent, indentAfterMarker, initial, isOrdered, itemLines, l, listLines, listTokIdx, markerCharCode, markerValue, max2, nextLine, offset, oldListIndent, oldParentType, oldSCount, oldTShift, oldTight, pos, posAfterMarker, prevEmptyEnd, start, terminate, terminatorRules, token, isTerminatingParagraph = false, tight = true;
          if (!state.md.options.allowIndentation && state.sCount[startLine] - state.blkIndent >= 4) {
            return false;
          }
          if (!state.md.options.allowIndentation && state.listIndent >= 0 && state.sCount[startLine] - state.listIndent >= 4 && state.sCount[startLine] < state.blkIndent) {
            return false;
          }
          if (silent && state.parentType === "paragraph") {
            if (state.sCount[startLine] >= state.blkIndent) {
              isTerminatingParagraph = true;
            }
          }
          if ((posAfterMarker = skipOrderedListMarker(state, startLine)) >= 0) {
            isOrdered = true;
            start = state.bMarks[startLine] + state.tShift[startLine];
            markerValue = Number(state.src.slice(start, posAfterMarker - 1));
            if (isTerminatingParagraph && markerValue !== 1)
              return false;
          } else if ((posAfterMarker = skipBulletListMarker(state, startLine)) >= 0) {
            isOrdered = false;
          } else {
            return false;
          }
          if (isTerminatingParagraph) {
            if (state.skipSpaces(posAfterMarker) >= state.eMarks[startLine])
              return false;
          }
          markerCharCode = state.src.charCodeAt(posAfterMarker - 1);
          if (silent) {
            return true;
          }
          listTokIdx = state.tokens.length;
          if (isOrdered) {
            token = state.push("ordered_list_open", "ol", 1);
            if (markerValue !== 1) {
              token.attrs = [["start", markerValue]];
            }
          } else {
            token = state.push("bullet_list_open", "ul", 1);
          }
          token.map = listLines = [startLine, 0];
          token.markup = String.fromCharCode(markerCharCode);
          nextLine = startLine;
          prevEmptyEnd = false;
          terminatorRules = state.md.block.ruler.getRules("list");
          oldParentType = state.parentType;
          state.parentType = "list";
          while (nextLine < endLine) {
            pos = posAfterMarker;
            max2 = state.eMarks[nextLine];
            initial = offset = state.sCount[nextLine] + posAfterMarker - (state.bMarks[startLine] + state.tShift[startLine]);
            while (pos < max2) {
              ch = state.src.charCodeAt(pos);
              if (ch === 9) {
                offset += 4 - (offset + state.bsCount[nextLine]) % 4;
              } else if (ch === 32) {
                offset++;
              } else {
                break;
              }
              pos++;
            }
            contentStart = pos;
            if (contentStart >= max2) {
              indentAfterMarker = 1;
            } else {
              indentAfterMarker = offset - initial;
            }
            if (!state.md.options.allowIndentation && indentAfterMarker > 4) {
              indentAfterMarker = 1;
            }
            indent = initial + indentAfterMarker;
            token = state.push("list_item_open", "li", 1);
            token.markup = String.fromCharCode(markerCharCode);
            token.map = itemLines = [startLine, 0];
            if (isOrdered) {
              token.info = state.src.slice(start, posAfterMarker - 1);
            }
            oldTight = state.tight;
            oldTShift = state.tShift[startLine];
            oldSCount = state.sCount[startLine];
            oldListIndent = state.listIndent;
            state.listIndent = state.blkIndent;
            state.blkIndent = indent;
            state.tight = true;
            state.tShift[startLine] = contentStart - state.bMarks[startLine];
            state.sCount[startLine] = offset;
            if (contentStart >= max2 && state.isEmpty(startLine + 1)) {
              state.line = Math.min(state.line + 2, endLine);
            } else {
              state.md.block.tokenize(state, startLine, endLine, true);
            }
            if (!state.tight || prevEmptyEnd) {
              tight = false;
            }
            prevEmptyEnd = state.line - startLine > 1 && state.isEmpty(state.line - 1);
            state.blkIndent = state.listIndent;
            state.listIndent = oldListIndent;
            state.tShift[startLine] = oldTShift;
            state.sCount[startLine] = oldSCount;
            state.tight = oldTight;
            token = state.push("list_item_close", "li", -1);
            token.markup = String.fromCharCode(markerCharCode);
            nextLine = startLine = state.line;
            itemLines[1] = nextLine;
            contentStart = state.bMarks[startLine];
            if (nextLine >= endLine) {
              break;
            }
            if (state.sCount[nextLine] < state.blkIndent) {
              break;
            }
            if (!state.md.options.allowIndentation && state.sCount[startLine] - state.blkIndent >= 4) {
              break;
            }
            terminate = false;
            for (i = 0, l = terminatorRules.length; i < l; i++) {
              if (terminatorRules[i](state, nextLine, endLine, true)) {
                terminate = true;
                break;
              }
            }
            if (terminate) {
              break;
            }
            if (isOrdered) {
              posAfterMarker = skipOrderedListMarker(state, nextLine);
              if (posAfterMarker < 0) {
                break;
              }
              start = state.bMarks[nextLine] + state.tShift[nextLine];
            } else {
              posAfterMarker = skipBulletListMarker(state, nextLine);
              if (posAfterMarker < 0) {
                break;
              }
            }
            if (markerCharCode !== state.src.charCodeAt(posAfterMarker - 1)) {
              break;
            }
          }
          if (isOrdered) {
            token = state.push("ordered_list_close", "ol", -1);
          } else {
            token = state.push("bullet_list_close", "ul", -1);
          }
          token.markup = String.fromCharCode(markerCharCode);
          listLines[1] = nextLine;
          state.line = nextLine;
          state.parentType = oldParentType;
          if (tight) {
            markTightParagraphs(state, listTokIdx);
          }
          return true;
        }, "list2");
      }
    });
    require_reference = __commonJS2({
      "node_modules/markdown-it/lib/rules_block/reference.js"(exports, module) {
        "use strict";
        var normalizeReference = require_utils().normalizeReference;
        var isSpace = require_utils().isSpace;
        module.exports = /* @__PURE__ */ __name(function reference(state, startLine, _endLine, silent) {
          var ch, destEndPos, destEndLineNo, endLine, href, i, l, label, labelEnd, oldParentType, res, start, str, terminate, terminatorRules, title, lines = 0, pos = state.bMarks[startLine] + state.tShift[startLine], max2 = state.eMarks[startLine], nextLine = startLine + 1;
          if (!state.md.options.allowIndentation && state.sCount[startLine] - state.blkIndent >= 4) {
            return false;
          }
          if (state.src.charCodeAt(pos) !== 91) {
            return false;
          }
          while (++pos < max2) {
            if (state.src.charCodeAt(pos) === 93 && state.src.charCodeAt(pos - 1) !== 92) {
              if (pos + 1 === max2) {
                return false;
              }
              if (state.src.charCodeAt(pos + 1) !== 58) {
                return false;
              }
              break;
            }
          }
          endLine = state.lineMax;
          terminatorRules = state.md.block.ruler.getRules("reference");
          oldParentType = state.parentType;
          state.parentType = "reference";
          for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
            if (!state.md.options.allowIndentation && state.sCount[nextLine] - state.blkIndent > 3) {
              continue;
            }
            if (state.sCount[nextLine] < 0) {
              continue;
            }
            terminate = false;
            for (i = 0, l = terminatorRules.length; i < l; i++) {
              if (terminatorRules[i](state, nextLine, endLine, true)) {
                terminate = true;
                break;
              }
            }
            if (terminate) {
              break;
            }
          }
          str = state.getLines(startLine, nextLine, state.blkIndent, false).trim();
          max2 = str.length;
          for (pos = 1; pos < max2; pos++) {
            ch = str.charCodeAt(pos);
            if (ch === 91) {
              return false;
            } else if (ch === 93) {
              labelEnd = pos;
              break;
            } else if (ch === 10) {
              lines++;
            } else if (ch === 92) {
              pos++;
              if (pos < max2 && str.charCodeAt(pos) === 10) {
                lines++;
              }
            }
          }
          if (labelEnd < 0 || str.charCodeAt(labelEnd + 1) !== 58) {
            return false;
          }
          for (pos = labelEnd + 2; pos < max2; pos++) {
            ch = str.charCodeAt(pos);
            if (ch === 10) {
              lines++;
            } else if (isSpace(ch)) {
            } else {
              break;
            }
          }
          res = state.md.helpers.parseLinkDestination(str, pos, max2);
          if (!res.ok) {
            return false;
          }
          href = state.md.normalizeLink(res.str);
          if (!state.md.validateLink(href)) {
            return false;
          }
          pos = res.pos;
          lines += res.lines;
          destEndPos = pos;
          destEndLineNo = lines;
          start = pos;
          for (; pos < max2; pos++) {
            ch = str.charCodeAt(pos);
            if (ch === 10) {
              lines++;
            } else if (isSpace(ch)) {
            } else {
              break;
            }
          }
          res = state.md.helpers.parseLinkTitle(str, pos, max2);
          if (pos < max2 && start !== pos && res.ok) {
            title = res.str;
            pos = res.pos;
            lines += res.lines;
          } else {
            title = "";
            pos = destEndPos;
            lines = destEndLineNo;
          }
          while (pos < max2) {
            ch = str.charCodeAt(pos);
            if (!isSpace(ch)) {
              break;
            }
            pos++;
          }
          if (pos < max2 && str.charCodeAt(pos) !== 10) {
            if (title) {
              title = "";
              pos = destEndPos;
              lines = destEndLineNo;
              while (pos < max2) {
                ch = str.charCodeAt(pos);
                if (!isSpace(ch)) {
                  break;
                }
                pos++;
              }
            }
          }
          if (pos < max2 && str.charCodeAt(pos) !== 10) {
            return false;
          }
          label = normalizeReference(str.slice(1, labelEnd));
          if (!label) {
            return false;
          }
          if (silent) {
            return true;
          }
          if (typeof state.env.references === "undefined") {
            state.env.references = {};
          }
          if (typeof state.env.references[label] === "undefined") {
            state.env.references[label] = { title, href };
          }
          state.parentType = oldParentType;
          state.line = startLine + lines + 1;
          return true;
        }, "reference");
      }
    });
    require_html_blocks = __commonJS2({
      "node_modules/markdown-it/lib/common/html_blocks.js"(exports, module) {
        "use strict";
        module.exports = [
          "address",
          "article",
          "aside",
          "base",
          "basefont",
          "blockquote",
          "body",
          "caption",
          "center",
          "col",
          "colgroup",
          "dd",
          "details",
          "dialog",
          "dir",
          "div",
          "dl",
          "dt",
          "fieldset",
          "figcaption",
          "figure",
          "footer",
          "form",
          "frame",
          "frameset",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "head",
          "header",
          "hr",
          "html",
          "iframe",
          "legend",
          "li",
          "link",
          "main",
          "menu",
          "menuitem",
          "nav",
          "noframes",
          "ol",
          "optgroup",
          "option",
          "p",
          "param",
          "section",
          "source",
          "summary",
          "table",
          "tbody",
          "td",
          "tfoot",
          "th",
          "thead",
          "title",
          "tr",
          "track",
          "ul"
        ];
      }
    });
    require_html_re = __commonJS2({
      "node_modules/markdown-it/lib/common/html_re.js"(exports, module) {
        "use strict";
        var attr_name = "[a-zA-Z_:][a-zA-Z0-9:._-]*";
        var unquoted = "[^\"'=<>`\\x00-\\x20]+";
        var single_quoted = "'[^']*'";
        var double_quoted = '"[^"]*"';
        var attr_value = "(?:" + unquoted + "|" + single_quoted + "|" + double_quoted + ")";
        var attribute = "(?:\\s+" + attr_name + "(?:\\s*=\\s*" + attr_value + ")?)";
        var open_tag = "<[A-Za-z][A-Za-z0-9\\-]*" + attribute + "*\\s*\\/?>";
        var close_tag = "<\\/[A-Za-z][A-Za-z0-9\\-]*\\s*>";
        var comment2 = "<!---->|<!--(?:-?[^>-])(?:-?[^-])*-->";
        var processing = "<[?][\\s\\S]*?[?]>";
        var declaration = "<![A-Z]+\\s+[^>]*>";
        var cdata = "<!\\[CDATA\\[[\\s\\S]*?\\]\\]>";
        var HTML_TAG_RE = new RegExp("^(?:" + open_tag + "|" + close_tag + "|" + comment2 + "|" + processing + "|" + declaration + "|" + cdata + ")");
        var HTML_OPEN_CLOSE_TAG_RE = new RegExp("^(?:" + open_tag + "|" + close_tag + ")");
        module.exports.HTML_TAG_RE = HTML_TAG_RE;
        module.exports.HTML_OPEN_CLOSE_TAG_RE = HTML_OPEN_CLOSE_TAG_RE;
      }
    });
    require_html_block = __commonJS2({
      "node_modules/markdown-it/lib/rules_block/html_block.js"(exports, module) {
        "use strict";
        var block_names = require_html_blocks();
        var HTML_OPEN_CLOSE_TAG_RE = require_html_re().HTML_OPEN_CLOSE_TAG_RE;
        var HTML_SEQUENCES = [
          [/^<(script|pre|style|textarea)(?=(\s|>|$))/i, /<\/(script|pre|style|textarea)>/i, true],
          [/^<!--/, /-->/, true],
          [/^<\?/, /\?>/, true],
          [/^<![A-Z]/, />/, true],
          [/^<!\[CDATA\[/, /\]\]>/, true],
          [new RegExp("^</?(" + block_names.join("|") + ")(?=(\\s|/?>|$))", "i"), /^$/, true],
          [new RegExp(HTML_OPEN_CLOSE_TAG_RE.source + "\\s*$"), /^$/, false]
        ];
        module.exports = /* @__PURE__ */ __name(function html_block(state, startLine, endLine, silent) {
          var i, nextLine, token, lineText, pos = state.bMarks[startLine] + state.tShift[startLine], max2 = state.eMarks[startLine];
          if (!state.md.options.allowIndentation && state.sCount[startLine] - state.blkIndent >= 4) {
            return false;
          }
          if (!state.md.options.html) {
            return false;
          }
          if (state.src.charCodeAt(pos) !== 60) {
            return false;
          }
          lineText = state.src.slice(pos, max2);
          for (i = 0; i < HTML_SEQUENCES.length; i++) {
            if (HTML_SEQUENCES[i][0].test(lineText)) {
              break;
            }
          }
          if (i === HTML_SEQUENCES.length) {
            return false;
          }
          if (silent) {
            return HTML_SEQUENCES[i][2];
          }
          nextLine = startLine + 1;
          if (!HTML_SEQUENCES[i][1].test(lineText)) {
            for (; nextLine < endLine; nextLine++) {
              if (state.sCount[nextLine] < state.blkIndent) {
                break;
              }
              pos = state.bMarks[nextLine] + state.tShift[nextLine];
              max2 = state.eMarks[nextLine];
              lineText = state.src.slice(pos, max2);
              if (HTML_SEQUENCES[i][1].test(lineText)) {
                if (lineText.length !== 0) {
                  nextLine++;
                }
                break;
              }
            }
          }
          state.line = nextLine;
          token = state.push("html_block", "", 0);
          token.map = [startLine, nextLine];
          token.content = state.getLines(startLine, nextLine, state.blkIndent, true);
          return true;
        }, "html_block");
      }
    });
    require_heading = __commonJS2({
      "node_modules/markdown-it/lib/rules_block/heading.js"(exports, module) {
        "use strict";
        var isSpace = require_utils().isSpace;
        module.exports = /* @__PURE__ */ __name(function heading2(state, startLine, endLine, silent) {
          var ch, level, tmp, token, pos = state.bMarks[startLine] + state.tShift[startLine], max2 = state.eMarks[startLine];
          if (!state.md.options.allowIndentation && state.sCount[startLine] - state.blkIndent >= 4) {
            return false;
          }
          ch = state.src.charCodeAt(pos);
          if (ch !== 35 || pos >= max2) {
            return false;
          }
          level = 1;
          ch = state.src.charCodeAt(++pos);
          while (ch === 35 && pos < max2 && level <= 6) {
            level++;
            ch = state.src.charCodeAt(++pos);
          }
          if (level > 6 || pos < max2 && !isSpace(ch)) {
            return false;
          }
          if (silent) {
            return true;
          }
          max2 = state.skipSpacesBack(max2, pos);
          tmp = state.skipCharsBack(max2, 35, pos);
          if (tmp > pos && isSpace(state.src.charCodeAt(tmp - 1))) {
            max2 = tmp;
          }
          state.line = startLine + 1;
          token = state.push("heading_open", "h" + String(level), 1);
          token.markup = "########".slice(0, level);
          token.map = [startLine, state.line];
          token = state.push("inline", "", 0);
          token.content = state.src.slice(pos, max2).trim();
          token.map = [startLine, state.line];
          token.children = [];
          token = state.push("heading_close", "h" + String(level), -1);
          token.markup = "########".slice(0, level);
          return true;
        }, "heading2");
      }
    });
    require_lheading = __commonJS2({
      "node_modules/markdown-it/lib/rules_block/lheading.js"(exports, module) {
        "use strict";
        module.exports = /* @__PURE__ */ __name(function lheading(state, startLine, endLine) {
          var content, terminate, i, l, token, pos, max2, level, marker, nextLine = startLine + 1, oldParentType, terminatorRules = state.md.block.ruler.getRules("paragraph");
          if (!state.md.options.allowIndentation && state.sCount[startLine] - state.blkIndent >= 4) {
            return false;
          }
          oldParentType = state.parentType;
          state.parentType = "paragraph";
          for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
            if (!state.md.options.allowIndentation && state.sCount[nextLine] - state.blkIndent > 3) {
              continue;
            }
            if (state.sCount[nextLine] >= state.blkIndent) {
              pos = state.bMarks[nextLine] + state.tShift[nextLine];
              max2 = state.eMarks[nextLine];
              if (pos < max2) {
                marker = state.src.charCodeAt(pos);
                if (marker === 45 || marker === 61) {
                  pos = state.skipChars(pos, marker);
                  pos = state.skipSpaces(pos);
                  if (pos >= max2) {
                    level = marker === 61 ? 1 : 2;
                    break;
                  }
                }
              }
            }
            if (state.sCount[nextLine] < 0) {
              continue;
            }
            terminate = false;
            for (i = 0, l = terminatorRules.length; i < l; i++) {
              if (terminatorRules[i](state, nextLine, endLine, true)) {
                terminate = true;
                break;
              }
            }
            if (terminate) {
              break;
            }
          }
          if (!level) {
            return false;
          }
          content = state.getLines(startLine, nextLine, state.blkIndent, false).trim();
          state.line = nextLine + 1;
          token = state.push("heading_open", "h" + String(level), 1);
          token.markup = String.fromCharCode(marker);
          token.map = [startLine, state.line];
          token = state.push("inline", "", 0);
          token.content = content;
          token.map = [startLine, state.line - 1];
          token.children = [];
          token = state.push("heading_close", "h" + String(level), -1);
          token.markup = String.fromCharCode(marker);
          state.parentType = oldParentType;
          return true;
        }, "lheading");
      }
    });
    require_paragraph = __commonJS2({
      "node_modules/markdown-it/lib/rules_block/paragraph.js"(exports, module) {
        "use strict";
        module.exports = /* @__PURE__ */ __name(function paragraph2(state, startLine) {
          var content, terminate, i, l, token, oldParentType, nextLine = startLine + 1, terminatorRules = state.md.block.ruler.getRules("paragraph"), endLine = state.lineMax;
          oldParentType = state.parentType;
          state.parentType = "paragraph";
          for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
            if (!state.md.options.allowIndentation && state.sCount[nextLine] - state.blkIndent > 3) {
              continue;
            }
            if (state.sCount[nextLine] < 0) {
              continue;
            }
            terminate = false;
            for (i = 0, l = terminatorRules.length; i < l; i++) {
              if (terminatorRules[i](state, nextLine, endLine, true)) {
                terminate = true;
                break;
              }
            }
            if (terminate) {
              break;
            }
          }
          content = state.getLines(startLine, nextLine, state.blkIndent, false).trim();
          state.line = nextLine;
          token = state.push("paragraph_open", "p", 1);
          token.map = [startLine, state.line];
          token = state.push("inline", "", 0);
          token.content = content;
          token.map = [startLine, state.line];
          token.children = [];
          token = state.push("paragraph_close", "p", -1);
          state.parentType = oldParentType;
          return true;
        }, "paragraph2");
      }
    });
    require_state_block = __commonJS2({
      "node_modules/markdown-it/lib/rules_block/state_block.js"(exports, module) {
        "use strict";
        var Token = require_token();
        var isSpace = require_utils().isSpace;
        function StateBlock(src, md, env, tokens) {
          var ch, s2, start, pos, len, indent, offset, indent_found;
          this.src = src;
          this.md = md;
          this.env = env;
          this.tokens = tokens;
          this.bMarks = [];
          this.eMarks = [];
          this.tShift = [];
          this.sCount = [];
          this.bsCount = [];
          this.blkIndent = 0;
          this.line = 0;
          this.lineMax = 0;
          this.tight = false;
          this.ddIndent = -1;
          this.listIndent = -1;
          this.parentType = "root";
          this.level = 0;
          this.result = "";
          s2 = this.src;
          indent_found = false;
          for (start = pos = indent = offset = 0, len = s2.length; pos < len; pos++) {
            ch = s2.charCodeAt(pos);
            if (!indent_found) {
              if (isSpace(ch)) {
                indent++;
                if (ch === 9) {
                  offset += 4 - offset % 4;
                } else {
                  offset++;
                }
                continue;
              } else {
                indent_found = true;
              }
            }
            if (ch === 10 || pos === len - 1) {
              if (ch !== 10) {
                pos++;
              }
              this.bMarks.push(start);
              this.eMarks.push(pos);
              this.tShift.push(indent);
              this.sCount.push(offset);
              this.bsCount.push(0);
              indent_found = false;
              indent = 0;
              offset = 0;
              start = pos + 1;
            }
          }
          this.bMarks.push(s2.length);
          this.eMarks.push(s2.length);
          this.tShift.push(0);
          this.sCount.push(0);
          this.bsCount.push(0);
          this.lineMax = this.bMarks.length - 1;
        }
        __name(StateBlock, "StateBlock");
        StateBlock.prototype.push = function(type2, tag, nesting) {
          var token = new Token(type2, tag, nesting);
          token.block = true;
          if (nesting < 0)
            this.level--;
          token.level = this.level;
          if (nesting > 0)
            this.level++;
          this.tokens.push(token);
          return token;
        };
        StateBlock.prototype.isEmpty = /* @__PURE__ */ __name(function isEmpty(line) {
          return this.bMarks[line] + this.tShift[line] >= this.eMarks[line];
        }, "isEmpty");
        StateBlock.prototype.skipEmptyLines = /* @__PURE__ */ __name(function skipEmptyLines(from) {
          for (var max2 = this.lineMax; from < max2; from++) {
            if (this.bMarks[from] + this.tShift[from] < this.eMarks[from]) {
              break;
            }
          }
          return from;
        }, "skipEmptyLines");
        StateBlock.prototype.skipSpaces = /* @__PURE__ */ __name(function skipSpaces(pos) {
          var ch;
          for (var max2 = this.src.length; pos < max2; pos++) {
            ch = this.src.charCodeAt(pos);
            if (!isSpace(ch)) {
              break;
            }
          }
          return pos;
        }, "skipSpaces");
        StateBlock.prototype.skipSpacesBack = /* @__PURE__ */ __name(function skipSpacesBack(pos, min) {
          if (pos <= min) {
            return pos;
          }
          while (pos > min) {
            if (!isSpace(this.src.charCodeAt(--pos))) {
              return pos + 1;
            }
          }
          return pos;
        }, "skipSpacesBack");
        StateBlock.prototype.skipChars = /* @__PURE__ */ __name(function skipChars(pos, code2) {
          for (var max2 = this.src.length; pos < max2; pos++) {
            if (this.src.charCodeAt(pos) !== code2) {
              break;
            }
          }
          return pos;
        }, "skipChars");
        StateBlock.prototype.skipCharsBack = /* @__PURE__ */ __name(function skipCharsBack(pos, code2, min) {
          if (pos <= min) {
            return pos;
          }
          while (pos > min) {
            if (code2 !== this.src.charCodeAt(--pos)) {
              return pos + 1;
            }
          }
          return pos;
        }, "skipCharsBack");
        StateBlock.prototype.getLines = /* @__PURE__ */ __name(function getLines(begin, end, indent, keepLastLF) {
          var i, lineIndent, ch, first, last, queue, lineStart, line = begin;
          if (begin >= end) {
            return "";
          }
          queue = new Array(end - begin);
          for (i = 0; line < end; line++, i++) {
            lineIndent = 0;
            lineStart = first = this.bMarks[line];
            if (line + 1 < end || keepLastLF) {
              last = this.eMarks[line] + 1;
            } else {
              last = this.eMarks[line];
            }
            while (first < last && lineIndent < indent) {
              ch = this.src.charCodeAt(first);
              if (isSpace(ch)) {
                if (ch === 9) {
                  lineIndent += 4 - (lineIndent + this.bsCount[line]) % 4;
                } else {
                  lineIndent++;
                }
              } else if (first - lineStart < this.tShift[line]) {
                lineIndent++;
              } else {
                break;
              }
              first++;
            }
            if (lineIndent > indent) {
              queue[i] = new Array(lineIndent - indent + 1).join(" ") + this.src.slice(first, last);
            } else {
              queue[i] = this.src.slice(first, last);
            }
          }
          return queue.join("");
        }, "getLines");
        StateBlock.prototype.Token = Token;
        module.exports = StateBlock;
      }
    });
    require_parser_block = __commonJS2({
      "node_modules/markdown-it/lib/parser_block.js"(exports, module) {
        "use strict";
        var Ruler = require_ruler();
        var _rules = [
          ["table", require_table(), ["paragraph", "reference"]],
          ["code", require_code()],
          ["fence", require_fence(), ["paragraph", "reference", "blockquote", "list"]],
          ["blockquote", require_blockquote(), ["paragraph", "reference", "blockquote", "list"]],
          ["hr", require_hr(), ["paragraph", "reference", "blockquote", "list"]],
          ["list", require_list(), ["paragraph", "reference", "blockquote"]],
          ["reference", require_reference()],
          ["html_block", require_html_block(), ["paragraph", "reference", "blockquote"]],
          ["heading", require_heading(), ["paragraph", "reference", "blockquote"]],
          ["lheading", require_lheading()],
          ["paragraph", require_paragraph()]
        ];
        function ParserBlock() {
          this.ruler = new Ruler();
          for (var i = 0; i < _rules.length; i++) {
            this.ruler.push(_rules[i][0], _rules[i][1], { alt: (_rules[i][2] || []).slice() });
          }
        }
        __name(ParserBlock, "ParserBlock");
        ParserBlock.prototype.tokenize = function(state, startLine, endLine) {
          var ok, i, rules = this.ruler.getRules(""), len = rules.length, line = startLine, hasEmptyLines = false, maxNesting = state.md.options.maxNesting;
          while (line < endLine) {
            state.line = line = state.skipEmptyLines(line);
            if (line >= endLine) {
              break;
            }
            if (state.sCount[line] < state.blkIndent) {
              break;
            }
            if (state.level >= maxNesting) {
              state.line = endLine;
              break;
            }
            for (i = 0; i < len; i++) {
              ok = rules[i](state, line, endLine, false);
              if (ok) {
                break;
              }
            }
            state.tight = !hasEmptyLines;
            if (state.isEmpty(state.line - 1)) {
              hasEmptyLines = true;
            }
            line = state.line;
            if (line < endLine && state.isEmpty(line)) {
              hasEmptyLines = true;
              line++;
              state.line = line;
            }
          }
        };
        ParserBlock.prototype.parse = function(src, md, env, outTokens) {
          var state;
          if (!src) {
            return;
          }
          state = new this.State(src, md, env, outTokens);
          this.tokenize(state, state.line, state.lineMax);
        };
        ParserBlock.prototype.State = require_state_block();
        module.exports = ParserBlock;
      }
    });
    require_text = __commonJS2({
      "node_modules/markdown-it/lib/rules_inline/text.js"(exports, module) {
        "use strict";
        function isTerminatorChar(ch) {
          switch (ch) {
            case 10:
            case 33:
            case 35:
            case 36:
            case 37:
            case 38:
            case 42:
            case 43:
            case 45:
            case 58:
            case 60:
            case 61:
            case 62:
            case 64:
            case 91:
            case 92:
            case 93:
            case 94:
            case 95:
            case 96:
            case 123:
            case 125:
            case 126:
              return true;
            default:
              return false;
          }
        }
        __name(isTerminatorChar, "isTerminatorChar");
        module.exports = /* @__PURE__ */ __name(function text22(state, silent) {
          var pos = state.pos;
          while (pos < state.posMax && !isTerminatorChar(state.src.charCodeAt(pos))) {
            pos++;
          }
          if (pos === state.pos) {
            return false;
          }
          if (!silent) {
            state.pending += state.src.slice(state.pos, pos);
          }
          state.pos = pos;
          return true;
        }, "text2");
      }
    });
    require_newline = __commonJS2({
      "node_modules/markdown-it/lib/rules_inline/newline.js"(exports, module) {
        "use strict";
        var isSpace = require_utils().isSpace;
        module.exports = /* @__PURE__ */ __name(function newline(state, silent) {
          var pmax, max2, ws, pos = state.pos;
          if (state.src.charCodeAt(pos) !== 10) {
            return false;
          }
          pmax = state.pending.length - 1;
          max2 = state.posMax;
          if (!silent) {
            if (pmax >= 0 && state.pending.charCodeAt(pmax) === 32) {
              if (pmax >= 1 && state.pending.charCodeAt(pmax - 1) === 32) {
                ws = pmax - 1;
                while (ws >= 1 && state.pending.charCodeAt(ws - 1) === 32)
                  ws--;
                state.pending = state.pending.slice(0, ws);
                state.push("hardbreak", "br", 0);
              } else {
                state.pending = state.pending.slice(0, -1);
                state.push("softbreak", "br", 0);
              }
            } else {
              state.push("softbreak", "br", 0);
            }
          }
          pos++;
          while (pos < max2 && isSpace(state.src.charCodeAt(pos))) {
            pos++;
          }
          state.pos = pos;
          return true;
        }, "newline");
      }
    });
    require_escape = __commonJS2({
      "node_modules/markdown-it/lib/rules_inline/escape.js"(exports, module) {
        "use strict";
        var isSpace = require_utils().isSpace;
        var ESCAPED = [];
        for (i = 0; i < 256; i++) {
          ESCAPED.push(0);
        }
        var i;
        "\\!\"#$%&'()*+,./:;<=>?@[]^_`{|}~-".split("").forEach(function(ch) {
          ESCAPED[ch.charCodeAt(0)] = 1;
        });
        module.exports = /* @__PURE__ */ __name(function escape(state, silent) {
          var ch, pos = state.pos, max2 = state.posMax;
          if (state.src.charCodeAt(pos) !== 92) {
            return false;
          }
          pos++;
          if (pos < max2) {
            ch = state.src.charCodeAt(pos);
            if (ch < 256 && ESCAPED[ch] !== 0) {
              if (!silent) {
                state.pending += state.src[pos];
              }
              state.pos += 2;
              return true;
            }
            if (ch === 10) {
              if (!silent) {
                state.push("hardbreak", "br", 0);
              }
              pos++;
              while (pos < max2) {
                ch = state.src.charCodeAt(pos);
                if (!isSpace(ch)) {
                  break;
                }
                pos++;
              }
              state.pos = pos;
              return true;
            }
          }
          if (!silent) {
            state.pending += "\\";
          }
          state.pos++;
          return true;
        }, "escape");
      }
    });
    require_backticks = __commonJS2({
      "node_modules/markdown-it/lib/rules_inline/backticks.js"(exports, module) {
        "use strict";
        module.exports = /* @__PURE__ */ __name(function backtick(state, silent) {
          var start, max2, marker, token, matchStart, matchEnd, openerLength, closerLength, pos = state.pos, ch = state.src.charCodeAt(pos);
          if (ch !== 96) {
            return false;
          }
          start = pos;
          pos++;
          max2 = state.posMax;
          while (pos < max2 && state.src.charCodeAt(pos) === 96) {
            pos++;
          }
          marker = state.src.slice(start, pos);
          openerLength = marker.length;
          if (state.backticksScanned && (state.backticks[openerLength] || 0) <= start) {
            if (!silent)
              state.pending += marker;
            state.pos += openerLength;
            return true;
          }
          matchStart = matchEnd = pos;
          while ((matchStart = state.src.indexOf("`", matchEnd)) !== -1) {
            matchEnd = matchStart + 1;
            while (matchEnd < max2 && state.src.charCodeAt(matchEnd) === 96) {
              matchEnd++;
            }
            closerLength = matchEnd - matchStart;
            if (closerLength === openerLength) {
              if (!silent) {
                token = state.push("code_inline", "code", 0);
                token.markup = marker;
                token.content = state.src.slice(pos, matchStart).replace(/\n/g, " ").replace(/^ (.+) $/, "$1");
              }
              state.pos = matchEnd;
              return true;
            }
            state.backticks[closerLength] = matchStart;
          }
          state.backticksScanned = true;
          if (!silent)
            state.pending += marker;
          state.pos += openerLength;
          return true;
        }, "backtick");
      }
    });
    require_strikethrough = __commonJS2({
      "node_modules/markdown-it/lib/rules_inline/strikethrough.js"(exports, module) {
        "use strict";
        module.exports.tokenize = /* @__PURE__ */ __name(function strikethrough(state, silent) {
          var i, scanned, token, len, ch, start = state.pos, marker = state.src.charCodeAt(start);
          if (silent) {
            return false;
          }
          if (marker !== 126) {
            return false;
          }
          scanned = state.scanDelims(state.pos, true);
          len = scanned.length;
          ch = String.fromCharCode(marker);
          if (len < 2) {
            return false;
          }
          if (len % 2) {
            token = state.push("text", "", 0);
            token.content = ch;
            len--;
          }
          for (i = 0; i < len; i += 2) {
            token = state.push("text", "", 0);
            token.content = ch + ch;
            state.delimiters.push({
              marker,
              length: 0,
              token: state.tokens.length - 1,
              end: -1,
              open: scanned.can_open,
              close: scanned.can_close
            });
          }
          state.pos += scanned.length;
          return true;
        }, "strikethrough");
        function postProcess(state, delimiters) {
          var i, j, startDelim, endDelim, token, loneMarkers = [], max2 = delimiters.length;
          for (i = 0; i < max2; i++) {
            startDelim = delimiters[i];
            if (startDelim.marker !== 126) {
              continue;
            }
            if (startDelim.end === -1) {
              continue;
            }
            endDelim = delimiters[startDelim.end];
            token = state.tokens[startDelim.token];
            token.type = "s_open";
            token.tag = "s";
            token.nesting = 1;
            token.markup = "~~";
            token.content = "";
            token = state.tokens[endDelim.token];
            token.type = "s_close";
            token.tag = "s";
            token.nesting = -1;
            token.markup = "~~";
            token.content = "";
            if (state.tokens[endDelim.token - 1].type === "text" && state.tokens[endDelim.token - 1].content === "~") {
              loneMarkers.push(endDelim.token - 1);
            }
          }
          while (loneMarkers.length) {
            i = loneMarkers.pop();
            j = i + 1;
            while (j < state.tokens.length && state.tokens[j].type === "s_close") {
              j++;
            }
            j--;
            if (i !== j) {
              token = state.tokens[j];
              state.tokens[j] = state.tokens[i];
              state.tokens[i] = token;
            }
          }
        }
        __name(postProcess, "postProcess");
        module.exports.postProcess = /* @__PURE__ */ __name(function strikethrough(state) {
          var curr, tokens_meta = state.tokens_meta, max2 = state.tokens_meta.length;
          postProcess(state, state.delimiters);
          for (curr = 0; curr < max2; curr++) {
            if (tokens_meta[curr] && tokens_meta[curr].delimiters) {
              postProcess(state, tokens_meta[curr].delimiters);
            }
          }
        }, "strikethrough");
      }
    });
    require_emphasis = __commonJS2({
      "node_modules/markdown-it/lib/rules_inline/emphasis.js"(exports, module) {
        "use strict";
        module.exports.tokenize = /* @__PURE__ */ __name(function emphasis(state, silent) {
          var i, scanned, token, start = state.pos, marker = state.src.charCodeAt(start);
          if (silent) {
            return false;
          }
          if (marker !== 95 && marker !== 42) {
            return false;
          }
          scanned = state.scanDelims(state.pos, marker === 42);
          for (i = 0; i < scanned.length; i++) {
            token = state.push("text", "", 0);
            token.content = String.fromCharCode(marker);
            state.delimiters.push({
              marker,
              length: scanned.length,
              token: state.tokens.length - 1,
              end: -1,
              open: scanned.can_open,
              close: scanned.can_close
            });
          }
          state.pos += scanned.length;
          return true;
        }, "emphasis");
        function postProcess(state, delimiters) {
          var i, startDelim, endDelim, token, ch, isStrong, max2 = delimiters.length;
          for (i = max2 - 1; i >= 0; i--) {
            startDelim = delimiters[i];
            if (startDelim.marker !== 95 && startDelim.marker !== 42) {
              continue;
            }
            if (startDelim.end === -1) {
              continue;
            }
            endDelim = delimiters[startDelim.end];
            isStrong = i > 0 && delimiters[i - 1].end === startDelim.end + 1 && delimiters[i - 1].marker === startDelim.marker && delimiters[i - 1].token === startDelim.token - 1 && delimiters[startDelim.end + 1].token === endDelim.token + 1;
            ch = String.fromCharCode(startDelim.marker);
            token = state.tokens[startDelim.token];
            token.type = isStrong ? "strong_open" : "em_open";
            token.tag = isStrong ? "strong" : "em";
            token.nesting = 1;
            token.markup = isStrong ? ch + ch : ch;
            token.content = "";
            token = state.tokens[endDelim.token];
            token.type = isStrong ? "strong_close" : "em_close";
            token.tag = isStrong ? "strong" : "em";
            token.nesting = -1;
            token.markup = isStrong ? ch + ch : ch;
            token.content = "";
            if (isStrong) {
              state.tokens[delimiters[i - 1].token].content = "";
              state.tokens[delimiters[startDelim.end + 1].token].content = "";
              i--;
            }
          }
        }
        __name(postProcess, "postProcess");
        module.exports.postProcess = /* @__PURE__ */ __name(function emphasis(state) {
          var curr, tokens_meta = state.tokens_meta, max2 = state.tokens_meta.length;
          postProcess(state, state.delimiters);
          for (curr = 0; curr < max2; curr++) {
            if (tokens_meta[curr] && tokens_meta[curr].delimiters) {
              postProcess(state, tokens_meta[curr].delimiters);
            }
          }
        }, "emphasis");
      }
    });
    require_link = __commonJS2({
      "node_modules/markdown-it/lib/rules_inline/link.js"(exports, module) {
        "use strict";
        var normalizeReference = require_utils().normalizeReference;
        var isSpace = require_utils().isSpace;
        module.exports = /* @__PURE__ */ __name(function link2(state, silent) {
          var attrs, code2, label, labelEnd, labelStart, pos, res, ref, token, href = "", title = "", oldPos = state.pos, max2 = state.posMax, start = state.pos, parseReference = true;
          if (state.src.charCodeAt(state.pos) !== 91) {
            return false;
          }
          labelStart = state.pos + 1;
          labelEnd = state.md.helpers.parseLinkLabel(state, state.pos, true);
          if (labelEnd < 0) {
            return false;
          }
          pos = labelEnd + 1;
          if (pos < max2 && state.src.charCodeAt(pos) === 40) {
            parseReference = false;
            pos++;
            for (; pos < max2; pos++) {
              code2 = state.src.charCodeAt(pos);
              if (!isSpace(code2) && code2 !== 10) {
                break;
              }
            }
            if (pos >= max2) {
              return false;
            }
            start = pos;
            res = state.md.helpers.parseLinkDestination(state.src, pos, state.posMax);
            if (res.ok) {
              href = state.md.normalizeLink(res.str);
              if (state.md.validateLink(href)) {
                pos = res.pos;
              } else {
                href = "";
              }
              start = pos;
              for (; pos < max2; pos++) {
                code2 = state.src.charCodeAt(pos);
                if (!isSpace(code2) && code2 !== 10) {
                  break;
                }
              }
              res = state.md.helpers.parseLinkTitle(state.src, pos, state.posMax);
              if (pos < max2 && start !== pos && res.ok) {
                title = res.str;
                pos = res.pos;
                for (; pos < max2; pos++) {
                  code2 = state.src.charCodeAt(pos);
                  if (!isSpace(code2) && code2 !== 10) {
                    break;
                  }
                }
              }
            }
            if (pos >= max2 || state.src.charCodeAt(pos) !== 41) {
              parseReference = true;
            }
            pos++;
          }
          if (parseReference) {
            if (typeof state.env.references === "undefined") {
              return false;
            }
            if (pos < max2 && state.src.charCodeAt(pos) === 91) {
              start = pos + 1;
              pos = state.md.helpers.parseLinkLabel(state, pos);
              if (pos >= 0) {
                label = state.src.slice(start, pos++);
              } else {
                pos = labelEnd + 1;
              }
            } else {
              pos = labelEnd + 1;
            }
            if (!label) {
              label = state.src.slice(labelStart, labelEnd);
            }
            ref = state.env.references[normalizeReference(label)];
            if (!ref) {
              state.pos = oldPos;
              return false;
            }
            href = ref.href;
            title = ref.title;
          }
          if (!silent) {
            state.pos = labelStart;
            state.posMax = labelEnd;
            token = state.push("link_open", "a", 1);
            token.attrs = attrs = [["href", href]];
            if (title) {
              attrs.push(["title", title]);
            }
            state.md.inline.tokenize(state);
            token = state.push("link_close", "a", -1);
          }
          state.pos = pos;
          state.posMax = max2;
          return true;
        }, "link2");
      }
    });
    require_image = __commonJS2({
      "node_modules/markdown-it/lib/rules_inline/image.js"(exports, module) {
        "use strict";
        var normalizeReference = require_utils().normalizeReference;
        var isSpace = require_utils().isSpace;
        module.exports = /* @__PURE__ */ __name(function image22(state, silent) {
          var attrs, code2, content, label, labelEnd, labelStart, pos, ref, res, title, token, tokens, start, href = "", oldPos = state.pos, max2 = state.posMax;
          if (state.src.charCodeAt(state.pos) !== 33) {
            return false;
          }
          if (state.src.charCodeAt(state.pos + 1) !== 91) {
            return false;
          }
          labelStart = state.pos + 2;
          labelEnd = state.md.helpers.parseLinkLabel(state, state.pos + 1, false);
          if (labelEnd < 0) {
            return false;
          }
          pos = labelEnd + 1;
          if (pos < max2 && state.src.charCodeAt(pos) === 40) {
            pos++;
            for (; pos < max2; pos++) {
              code2 = state.src.charCodeAt(pos);
              if (!isSpace(code2) && code2 !== 10) {
                break;
              }
            }
            if (pos >= max2) {
              return false;
            }
            start = pos;
            res = state.md.helpers.parseLinkDestination(state.src, pos, state.posMax);
            if (res.ok) {
              href = state.md.normalizeLink(res.str);
              if (state.md.validateLink(href)) {
                pos = res.pos;
              } else {
                href = "";
              }
            }
            start = pos;
            for (; pos < max2; pos++) {
              code2 = state.src.charCodeAt(pos);
              if (!isSpace(code2) && code2 !== 10) {
                break;
              }
            }
            res = state.md.helpers.parseLinkTitle(state.src, pos, state.posMax);
            if (pos < max2 && start !== pos && res.ok) {
              title = res.str;
              pos = res.pos;
              for (; pos < max2; pos++) {
                code2 = state.src.charCodeAt(pos);
                if (!isSpace(code2) && code2 !== 10) {
                  break;
                }
              }
            } else {
              title = "";
            }
            if (pos >= max2 || state.src.charCodeAt(pos) !== 41) {
              state.pos = oldPos;
              return false;
            }
            pos++;
          } else {
            if (typeof state.env.references === "undefined") {
              return false;
            }
            if (pos < max2 && state.src.charCodeAt(pos) === 91) {
              start = pos + 1;
              pos = state.md.helpers.parseLinkLabel(state, pos);
              if (pos >= 0) {
                label = state.src.slice(start, pos++);
              } else {
                pos = labelEnd + 1;
              }
            } else {
              pos = labelEnd + 1;
            }
            if (!label) {
              label = state.src.slice(labelStart, labelEnd);
            }
            ref = state.env.references[normalizeReference(label)];
            if (!ref) {
              state.pos = oldPos;
              return false;
            }
            href = ref.href;
            title = ref.title;
          }
          if (!silent) {
            content = state.src.slice(labelStart, labelEnd);
            state.md.inline.parse(content, state.md, state.env, tokens = []);
            token = state.push("image", "img", 0);
            token.attrs = attrs = [["src", href], ["alt", ""]];
            token.children = tokens;
            token.content = content;
            if (title) {
              attrs.push(["title", title]);
            }
          }
          state.pos = pos;
          state.posMax = max2;
          return true;
        }, "image2");
      }
    });
    require_autolink = __commonJS2({
      "node_modules/markdown-it/lib/rules_inline/autolink.js"(exports, module) {
        "use strict";
        var EMAIL_RE = /^([a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)$/;
        var AUTOLINK_RE = /^([a-zA-Z][a-zA-Z0-9+.\-]{1,31}):([^<>\x00-\x20]*)$/;
        module.exports = /* @__PURE__ */ __name(function autolink(state, silent) {
          var url2, fullUrl, token, ch, start, max2, pos = state.pos;
          if (state.src.charCodeAt(pos) !== 60) {
            return false;
          }
          start = state.pos;
          max2 = state.posMax;
          for (; ; ) {
            if (++pos >= max2)
              return false;
            ch = state.src.charCodeAt(pos);
            if (ch === 60)
              return false;
            if (ch === 62)
              break;
          }
          url2 = state.src.slice(start + 1, pos);
          if (AUTOLINK_RE.test(url2)) {
            fullUrl = state.md.normalizeLink(url2);
            if (!state.md.validateLink(fullUrl)) {
              return false;
            }
            if (!silent) {
              token = state.push("link_open", "a", 1);
              token.attrs = [["href", fullUrl]];
              token.markup = "autolink";
              token.info = "auto";
              token = state.push("text", "", 0);
              token.content = state.md.normalizeLinkText(url2);
              token = state.push("link_close", "a", -1);
              token.markup = "autolink";
              token.info = "auto";
            }
            state.pos += url2.length + 2;
            return true;
          }
          if (EMAIL_RE.test(url2)) {
            fullUrl = state.md.normalizeLink("mailto:" + url2);
            if (!state.md.validateLink(fullUrl)) {
              return false;
            }
            if (!silent) {
              token = state.push("link_open", "a", 1);
              token.attrs = [["href", fullUrl]];
              token.markup = "autolink";
              token.info = "auto";
              token = state.push("text", "", 0);
              token.content = state.md.normalizeLinkText(url2);
              token = state.push("link_close", "a", -1);
              token.markup = "autolink";
              token.info = "auto";
            }
            state.pos += url2.length + 2;
            return true;
          }
          return false;
        }, "autolink");
      }
    });
    require_html_inline = __commonJS2({
      "node_modules/markdown-it/lib/rules_inline/html_inline.js"(exports, module) {
        "use strict";
        var HTML_TAG_RE = require_html_re().HTML_TAG_RE;
        function isLetter(ch) {
          var lc = ch | 32;
          return lc >= 97 && lc <= 122;
        }
        __name(isLetter, "isLetter");
        module.exports = /* @__PURE__ */ __name(function html_inline(state, silent) {
          var ch, match2, max2, token, pos = state.pos;
          if (!state.md.options.html) {
            return false;
          }
          max2 = state.posMax;
          if (state.src.charCodeAt(pos) !== 60 || pos + 2 >= max2) {
            return false;
          }
          ch = state.src.charCodeAt(pos + 1);
          if (ch !== 33 && ch !== 63 && ch !== 47 && !isLetter(ch)) {
            return false;
          }
          match2 = state.src.slice(pos).match(HTML_TAG_RE);
          if (!match2) {
            return false;
          }
          if (!silent) {
            token = state.push("html_inline", "", 0);
            token.content = state.src.slice(pos, pos + match2[0].length);
          }
          state.pos += match2[0].length;
          return true;
        }, "html_inline");
      }
    });
    require_entity = __commonJS2({
      "node_modules/markdown-it/lib/rules_inline/entity.js"(exports, module) {
        "use strict";
        var entities = require_entities2();
        var has = require_utils().has;
        var isValidEntityCode = require_utils().isValidEntityCode;
        var fromCodePoint = require_utils().fromCodePoint;
        var DIGITAL_RE = /^&#((?:x[a-f0-9]{1,6}|[0-9]{1,7}));/i;
        var NAMED_RE = /^&([a-z][a-z0-9]{1,31});/i;
        module.exports = /* @__PURE__ */ __name(function entity(state, silent) {
          var ch, code2, match2, pos = state.pos, max2 = state.posMax;
          if (state.src.charCodeAt(pos) !== 38) {
            return false;
          }
          if (pos + 1 < max2) {
            ch = state.src.charCodeAt(pos + 1);
            if (ch === 35) {
              match2 = state.src.slice(pos).match(DIGITAL_RE);
              if (match2) {
                if (!silent) {
                  code2 = match2[1][0].toLowerCase() === "x" ? parseInt(match2[1].slice(1), 16) : parseInt(match2[1], 10);
                  state.pending += isValidEntityCode(code2) ? fromCodePoint(code2) : fromCodePoint(65533);
                }
                state.pos += match2[0].length;
                return true;
              }
            } else {
              match2 = state.src.slice(pos).match(NAMED_RE);
              if (match2) {
                if (has(entities, match2[1])) {
                  if (!silent) {
                    state.pending += entities[match2[1]];
                  }
                  state.pos += match2[0].length;
                  return true;
                }
              }
            }
          }
          if (!silent) {
            state.pending += "&";
          }
          state.pos++;
          return true;
        }, "entity");
      }
    });
    require_balance_pairs = __commonJS2({
      "node_modules/markdown-it/lib/rules_inline/balance_pairs.js"(exports, module) {
        "use strict";
        function processDelimiters(state, delimiters) {
          var closerIdx, openerIdx, closer, opener, minOpenerIdx, newMinOpenerIdx, isOddMatch, lastJump, openersBottom = {}, max2 = delimiters.length;
          if (!max2)
            return;
          var headerIdx = 0;
          var lastTokenIdx = -2;
          var jumps = [];
          for (closerIdx = 0; closerIdx < max2; closerIdx++) {
            closer = delimiters[closerIdx];
            jumps.push(0);
            if (delimiters[headerIdx].marker !== closer.marker || lastTokenIdx !== closer.token - 1) {
              headerIdx = closerIdx;
            }
            lastTokenIdx = closer.token;
            closer.length = closer.length || 0;
            if (!closer.close)
              continue;
            if (!openersBottom.hasOwnProperty(closer.marker)) {
              openersBottom[closer.marker] = [-1, -1, -1, -1, -1, -1];
            }
            minOpenerIdx = openersBottom[closer.marker][(closer.open ? 3 : 0) + closer.length % 3];
            openerIdx = headerIdx - jumps[headerIdx] - 1;
            newMinOpenerIdx = openerIdx;
            for (; openerIdx > minOpenerIdx; openerIdx -= jumps[openerIdx] + 1) {
              opener = delimiters[openerIdx];
              if (opener.marker !== closer.marker)
                continue;
              if (opener.open && opener.end < 0) {
                isOddMatch = false;
                if (opener.close || closer.open) {
                  if ((opener.length + closer.length) % 3 === 0) {
                    if (opener.length % 3 !== 0 || closer.length % 3 !== 0) {
                      isOddMatch = true;
                    }
                  }
                }
                if (!isOddMatch) {
                  lastJump = openerIdx > 0 && !delimiters[openerIdx - 1].open ? jumps[openerIdx - 1] + 1 : 0;
                  jumps[closerIdx] = closerIdx - openerIdx + lastJump;
                  jumps[openerIdx] = lastJump;
                  closer.open = false;
                  opener.end = closerIdx;
                  opener.close = false;
                  newMinOpenerIdx = -1;
                  lastTokenIdx = -2;
                  break;
                }
              }
            }
            if (newMinOpenerIdx !== -1) {
              openersBottom[closer.marker][(closer.open ? 3 : 0) + (closer.length || 0) % 3] = newMinOpenerIdx;
            }
          }
        }
        __name(processDelimiters, "processDelimiters");
        module.exports = /* @__PURE__ */ __name(function link_pairs(state) {
          var curr, tokens_meta = state.tokens_meta, max2 = state.tokens_meta.length;
          processDelimiters(state, state.delimiters);
          for (curr = 0; curr < max2; curr++) {
            if (tokens_meta[curr] && tokens_meta[curr].delimiters) {
              processDelimiters(state, tokens_meta[curr].delimiters);
            }
          }
        }, "link_pairs");
      }
    });
    require_text_collapse = __commonJS2({
      "node_modules/markdown-it/lib/rules_inline/text_collapse.js"(exports, module) {
        "use strict";
        module.exports = /* @__PURE__ */ __name(function text_collapse(state) {
          var curr, last, level = 0, tokens = state.tokens, max2 = state.tokens.length;
          for (curr = last = 0; curr < max2; curr++) {
            if (tokens[curr].nesting < 0)
              level--;
            tokens[curr].level = level;
            if (tokens[curr].nesting > 0)
              level++;
            if (tokens[curr].type === "text" && curr + 1 < max2 && tokens[curr + 1].type === "text") {
              tokens[curr + 1].content = tokens[curr].content + tokens[curr + 1].content;
            } else {
              if (curr !== last) {
                tokens[last] = tokens[curr];
              }
              last++;
            }
          }
          if (curr !== last) {
            tokens.length = last;
          }
        }, "text_collapse");
      }
    });
    require_state_inline = __commonJS2({
      "node_modules/markdown-it/lib/rules_inline/state_inline.js"(exports, module) {
        "use strict";
        var Token = require_token();
        var isWhiteSpace = require_utils().isWhiteSpace;
        var isPunctChar = require_utils().isPunctChar;
        var isMdAsciiPunct = require_utils().isMdAsciiPunct;
        function StateInline(src, md, env, outTokens) {
          this.src = src;
          this.env = env;
          this.md = md;
          this.tokens = outTokens;
          this.tokens_meta = Array(outTokens.length);
          this.pos = 0;
          this.posMax = this.src.length;
          this.level = 0;
          this.pending = "";
          this.pendingLevel = 0;
          this.cache = {};
          this.delimiters = [];
          this._prev_delimiters = [];
          this.backticks = {};
          this.backticksScanned = false;
        }
        __name(StateInline, "StateInline");
        StateInline.prototype.pushPending = function() {
          var token = new Token("text", "", 0);
          token.content = this.pending;
          token.level = this.pendingLevel;
          this.tokens.push(token);
          this.pending = "";
          return token;
        };
        StateInline.prototype.push = function(type2, tag, nesting) {
          if (this.pending) {
            this.pushPending();
          }
          var token = new Token(type2, tag, nesting);
          var token_meta = null;
          if (nesting < 0) {
            this.level--;
            this.delimiters = this._prev_delimiters.pop();
          }
          token.level = this.level;
          if (nesting > 0) {
            this.level++;
            this._prev_delimiters.push(this.delimiters);
            this.delimiters = [];
            token_meta = { delimiters: this.delimiters };
          }
          this.pendingLevel = this.level;
          this.tokens.push(token);
          this.tokens_meta.push(token_meta);
          return token;
        };
        StateInline.prototype.scanDelims = function(start, canSplitWord) {
          var pos = start, lastChar, nextChar, count, can_open, can_close, isLastWhiteSpace, isLastPunctChar, isNextWhiteSpace, isNextPunctChar, left_flanking = true, right_flanking = true, max2 = this.posMax, marker = this.src.charCodeAt(start);
          lastChar = start > 0 ? this.src.charCodeAt(start - 1) : 32;
          while (pos < max2 && this.src.charCodeAt(pos) === marker) {
            pos++;
          }
          count = pos - start;
          nextChar = pos < max2 ? this.src.charCodeAt(pos) : 32;
          isLastPunctChar = isMdAsciiPunct(lastChar) || isPunctChar(String.fromCharCode(lastChar));
          isNextPunctChar = isMdAsciiPunct(nextChar) || isPunctChar(String.fromCharCode(nextChar));
          isLastWhiteSpace = isWhiteSpace(lastChar);
          isNextWhiteSpace = isWhiteSpace(nextChar);
          if (isNextWhiteSpace) {
            left_flanking = false;
          } else if (isNextPunctChar) {
            if (!(isLastWhiteSpace || isLastPunctChar)) {
              left_flanking = false;
            }
          }
          if (isLastWhiteSpace) {
            right_flanking = false;
          } else if (isLastPunctChar) {
            if (!(isNextWhiteSpace || isNextPunctChar)) {
              right_flanking = false;
            }
          }
          if (!canSplitWord) {
            can_open = left_flanking && (!right_flanking || isLastPunctChar);
            can_close = right_flanking && (!left_flanking || isNextPunctChar);
          } else {
            can_open = left_flanking;
            can_close = right_flanking;
          }
          return {
            can_open,
            can_close,
            length: count
          };
        };
        StateInline.prototype.Token = Token;
        module.exports = StateInline;
      }
    });
    require_parser_inline = __commonJS2({
      "node_modules/markdown-it/lib/parser_inline.js"(exports, module) {
        "use strict";
        var Ruler = require_ruler();
        var _rules = [
          ["text", require_text()],
          ["newline", require_newline()],
          ["escape", require_escape()],
          ["backticks", require_backticks()],
          ["strikethrough", require_strikethrough().tokenize],
          ["emphasis", require_emphasis().tokenize],
          ["link", require_link()],
          ["image", require_image()],
          ["autolink", require_autolink()],
          ["html_inline", require_html_inline()],
          ["entity", require_entity()]
        ];
        var _rules2 = [
          ["balance_pairs", require_balance_pairs()],
          ["strikethrough", require_strikethrough().postProcess],
          ["emphasis", require_emphasis().postProcess],
          ["text_collapse", require_text_collapse()]
        ];
        function ParserInline() {
          var i;
          this.ruler = new Ruler();
          for (i = 0; i < _rules.length; i++) {
            this.ruler.push(_rules[i][0], _rules[i][1]);
          }
          this.ruler2 = new Ruler();
          for (i = 0; i < _rules2.length; i++) {
            this.ruler2.push(_rules2[i][0], _rules2[i][1]);
          }
        }
        __name(ParserInline, "ParserInline");
        ParserInline.prototype.skipToken = function(state) {
          var ok, i, pos = state.pos, rules = this.ruler.getRules(""), len = rules.length, maxNesting = state.md.options.maxNesting, cache = state.cache;
          if (typeof cache[pos] !== "undefined") {
            state.pos = cache[pos];
            return;
          }
          if (state.level < maxNesting) {
            for (i = 0; i < len; i++) {
              state.level++;
              ok = rules[i](state, true);
              state.level--;
              if (ok) {
                break;
              }
            }
          } else {
            state.pos = state.posMax;
          }
          if (!ok) {
            state.pos++;
          }
          cache[pos] = state.pos;
        };
        ParserInline.prototype.tokenize = function(state) {
          var ok, i, rules = this.ruler.getRules(""), len = rules.length, end = state.posMax, maxNesting = state.md.options.maxNesting;
          while (state.pos < end) {
            if (state.level < maxNesting) {
              for (i = 0; i < len; i++) {
                ok = rules[i](state, false);
                if (ok) {
                  break;
                }
              }
            }
            if (ok) {
              if (state.pos >= end) {
                break;
              }
              continue;
            }
            state.pending += state.src[state.pos++];
          }
          if (state.pending) {
            state.pushPending();
          }
        };
        ParserInline.prototype.parse = function(str, md, env, outTokens) {
          var i, rules, len;
          var state = new this.State(str, md, env, outTokens);
          this.tokenize(state);
          rules = this.ruler2.getRules("");
          len = rules.length;
          for (i = 0; i < len; i++) {
            rules[i](state);
          }
        };
        ParserInline.prototype.State = require_state_inline();
        module.exports = ParserInline;
      }
    });
    require_re = __commonJS2({
      "node_modules/linkify-it/lib/re.js"(exports, module) {
        "use strict";
        module.exports = function(opts) {
          var re = {};
          re.src_Any = require_regex2().source;
          re.src_Cc = require_regex3().source;
          re.src_Z = require_regex5().source;
          re.src_P = require_regex().source;
          re.src_ZPCc = [re.src_Z, re.src_P, re.src_Cc].join("|");
          re.src_ZCc = [re.src_Z, re.src_Cc].join("|");
          var text_separators = "[><\uFF5C]";
          re.src_pseudo_letter = "(?:(?!" + text_separators + "|" + re.src_ZPCc + ")" + re.src_Any + ")";
          re.src_ip4 = "(?:(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)";
          re.src_auth = "(?:(?:(?!" + re.src_ZCc + "|[@/\\[\\]()]).)+@)?";
          re.src_port = "(?::(?:6(?:[0-4]\\d{3}|5(?:[0-4]\\d{2}|5(?:[0-2]\\d|3[0-5])))|[1-5]?\\d{1,4}))?";
          re.src_host_terminator = "(?=$|" + text_separators + "|" + re.src_ZPCc + ")(?!-|_|:\\d|\\.-|\\.(?!$|" + re.src_ZPCc + "))";
          re.src_path = "(?:[/?#](?:(?!" + re.src_ZCc + "|" + text_separators + `|[()[\\]{}.,"'?!\\-;]).|\\[(?:(?!` + re.src_ZCc + "|\\]).)*\\]|\\((?:(?!" + re.src_ZCc + "|[)]).)*\\)|\\{(?:(?!" + re.src_ZCc + '|[}]).)*\\}|\\"(?:(?!' + re.src_ZCc + `|["]).)+\\"|\\'(?:(?!` + re.src_ZCc + "|[']).)+\\'|\\'(?=" + re.src_pseudo_letter + "|[-]).|\\.{2,}[a-zA-Z0-9%/&]|\\.(?!" + re.src_ZCc + "|[.]).|" + (opts && opts["---"] ? "\\-(?!--(?:[^-]|$))(?:-*)|" : "\\-+|") + ",(?!" + re.src_ZCc + ").|;(?!" + re.src_ZCc + ").|\\!+(?!" + re.src_ZCc + "|[!]).|\\?(?!" + re.src_ZCc + "|[?]).)+|\\/)?";
          re.src_email_name = '[\\-;:&=\\+\\$,\\.a-zA-Z0-9_][\\-;:&=\\+\\$,\\"\\.a-zA-Z0-9_]*';
          re.src_xn = "xn--[a-z0-9\\-]{1,59}";
          re.src_domain_root = "(?:" + re.src_xn + "|" + re.src_pseudo_letter + "{1,63})";
          re.src_domain = "(?:" + re.src_xn + "|(?:" + re.src_pseudo_letter + ")|(?:" + re.src_pseudo_letter + "(?:-|" + re.src_pseudo_letter + "){0,61}" + re.src_pseudo_letter + "))";
          re.src_host = "(?:(?:(?:(?:" + re.src_domain + ")\\.)*" + re.src_domain + "))";
          re.tpl_host_fuzzy = "(?:" + re.src_ip4 + "|(?:(?:(?:" + re.src_domain + ")\\.)+(?:%TLDS%)))";
          re.tpl_host_no_ip_fuzzy = "(?:(?:(?:" + re.src_domain + ")\\.)+(?:%TLDS%))";
          re.src_host_strict = re.src_host + re.src_host_terminator;
          re.tpl_host_fuzzy_strict = re.tpl_host_fuzzy + re.src_host_terminator;
          re.src_host_port_strict = re.src_host + re.src_port + re.src_host_terminator;
          re.tpl_host_port_fuzzy_strict = re.tpl_host_fuzzy + re.src_port + re.src_host_terminator;
          re.tpl_host_port_no_ip_fuzzy_strict = re.tpl_host_no_ip_fuzzy + re.src_port + re.src_host_terminator;
          re.tpl_host_fuzzy_test = "localhost|www\\.|\\.\\d{1,3}\\.|(?:\\.(?:%TLDS%)(?:" + re.src_ZPCc + "|>|$))";
          re.tpl_email_fuzzy = "(^|" + text_separators + '|"|\\(|' + re.src_ZCc + ")(" + re.src_email_name + "@" + re.tpl_host_fuzzy_strict + ")";
          re.tpl_link_fuzzy = "(^|(?![.:/\\-_@])(?:[$+<=>^`|\uFF5C]|" + re.src_ZPCc + "))((?![$+<=>^`|\uFF5C])" + re.tpl_host_port_fuzzy_strict + re.src_path + ")";
          re.tpl_link_no_ip_fuzzy = "(^|(?![.:/\\-_@])(?:[$+<=>^`|\uFF5C]|" + re.src_ZPCc + "))((?![$+<=>^`|\uFF5C])" + re.tpl_host_port_no_ip_fuzzy_strict + re.src_path + ")";
          return re;
        };
      }
    });
    require_linkify_it = __commonJS2({
      "node_modules/linkify-it/index.js"(exports, module) {
        "use strict";
        function assign(obj) {
          var sources = Array.prototype.slice.call(arguments, 1);
          sources.forEach(function(source) {
            if (!source) {
              return;
            }
            Object.keys(source).forEach(function(key) {
              obj[key] = source[key];
            });
          });
          return obj;
        }
        __name(assign, "assign");
        function _class(obj) {
          return Object.prototype.toString.call(obj);
        }
        __name(_class, "_class");
        function isString2(obj) {
          return _class(obj) === "[object String]";
        }
        __name(isString2, "isString");
        function isObject2(obj) {
          return _class(obj) === "[object Object]";
        }
        __name(isObject2, "isObject");
        function isRegExp(obj) {
          return _class(obj) === "[object RegExp]";
        }
        __name(isRegExp, "isRegExp");
        function isFunction2(obj) {
          return _class(obj) === "[object Function]";
        }
        __name(isFunction2, "isFunction2");
        function escapeRE(str) {
          return str.replace(/[.?*+^$[\]\\(){}|-]/g, "\\$&");
        }
        __name(escapeRE, "escapeRE");
        var defaultOptions = {
          fuzzyLink: true,
          fuzzyEmail: true,
          fuzzyIP: false
        };
        function isOptionsObj(obj) {
          return Object.keys(obj || {}).reduce(function(acc, k) {
            return acc || defaultOptions.hasOwnProperty(k);
          }, false);
        }
        __name(isOptionsObj, "isOptionsObj");
        var defaultSchemas = {
          "http:": {
            validate: /* @__PURE__ */ __name(function(text22, pos, self) {
              var tail = text22.slice(pos);
              if (!self.re.http) {
                self.re.http = new RegExp("^\\/\\/" + self.re.src_auth + self.re.src_host_port_strict + self.re.src_path, "i");
              }
              if (self.re.http.test(tail)) {
                return tail.match(self.re.http)[0].length;
              }
              return 0;
            }, "validate")
          },
          "https:": "http:",
          "ftp:": "http:",
          "//": {
            validate: /* @__PURE__ */ __name(function(text22, pos, self) {
              var tail = text22.slice(pos);
              if (!self.re.no_http) {
                self.re.no_http = new RegExp("^" + self.re.src_auth + "(?:localhost|(?:(?:" + self.re.src_domain + ")\\.)+" + self.re.src_domain_root + ")" + self.re.src_port + self.re.src_host_terminator + self.re.src_path, "i");
              }
              if (self.re.no_http.test(tail)) {
                if (pos >= 3 && text22[pos - 3] === ":") {
                  return 0;
                }
                if (pos >= 3 && text22[pos - 3] === "/") {
                  return 0;
                }
                return tail.match(self.re.no_http)[0].length;
              }
              return 0;
            }, "validate")
          },
          "mailto:": {
            validate: /* @__PURE__ */ __name(function(text22, pos, self) {
              var tail = text22.slice(pos);
              if (!self.re.mailto) {
                self.re.mailto = new RegExp("^" + self.re.src_email_name + "@" + self.re.src_host_strict, "i");
              }
              if (self.re.mailto.test(tail)) {
                return tail.match(self.re.mailto)[0].length;
              }
              return 0;
            }, "validate")
          }
        };
        var tlds_2ch_src_re = "a[cdefgilmnoqrstuwxz]|b[abdefghijmnorstvwyz]|c[acdfghiklmnoruvwxyz]|d[ejkmoz]|e[cegrstu]|f[ijkmor]|g[abdefghilmnpqrstuwy]|h[kmnrtu]|i[delmnoqrst]|j[emop]|k[eghimnprwyz]|l[abcikrstuvy]|m[acdeghklmnopqrstuvwxyz]|n[acefgilopruz]|om|p[aefghklmnrstwy]|qa|r[eosuw]|s[abcdeghijklmnortuvxyz]|t[cdfghjklmnortvwz]|u[agksyz]|v[aceginu]|w[fs]|y[et]|z[amw]";
        var tlds_default = "biz|com|edu|gov|net|org|pro|web|xxx|aero|asia|coop|info|museum|name|shop|\u0440\u0444".split("|");
        function resetScanCache(self) {
          self.__index__ = -1;
          self.__text_cache__ = "";
        }
        __name(resetScanCache, "resetScanCache");
        function createValidator(re) {
          return function(text22, pos) {
            var tail = text22.slice(pos);
            if (re.test(tail)) {
              return tail.match(re)[0].length;
            }
            return 0;
          };
        }
        __name(createValidator, "createValidator");
        function createNormalizer() {
          return function(match2, self) {
            self.normalize(match2);
          };
        }
        __name(createNormalizer, "createNormalizer");
        function compile(self) {
          var re = self.re = require_re()(self.__opts__);
          var tlds = self.__tlds__.slice();
          self.onCompile();
          if (!self.__tlds_replaced__) {
            tlds.push(tlds_2ch_src_re);
          }
          tlds.push(re.src_xn);
          re.src_tlds = tlds.join("|");
          function untpl(tpl) {
            return tpl.replace("%TLDS%", re.src_tlds);
          }
          __name(untpl, "untpl");
          re.email_fuzzy = RegExp(untpl(re.tpl_email_fuzzy), "i");
          re.link_fuzzy = RegExp(untpl(re.tpl_link_fuzzy), "i");
          re.link_no_ip_fuzzy = RegExp(untpl(re.tpl_link_no_ip_fuzzy), "i");
          re.host_fuzzy_test = RegExp(untpl(re.tpl_host_fuzzy_test), "i");
          var aliases = [];
          self.__compiled__ = {};
          function schemaError(name, val) {
            throw new Error('(LinkifyIt) Invalid schema "' + name + '": ' + val);
          }
          __name(schemaError, "schemaError");
          Object.keys(self.__schemas__).forEach(function(name) {
            var val = self.__schemas__[name];
            if (val === null) {
              return;
            }
            var compiled = { validate: null, link: null };
            self.__compiled__[name] = compiled;
            if (isObject2(val)) {
              if (isRegExp(val.validate)) {
                compiled.validate = createValidator(val.validate);
              } else if (isFunction2(val.validate)) {
                compiled.validate = val.validate;
              } else {
                schemaError(name, val);
              }
              if (isFunction2(val.normalize)) {
                compiled.normalize = val.normalize;
              } else if (!val.normalize) {
                compiled.normalize = createNormalizer();
              } else {
                schemaError(name, val);
              }
              return;
            }
            if (isString2(val)) {
              aliases.push(name);
              return;
            }
            schemaError(name, val);
          });
          aliases.forEach(function(alias) {
            if (!self.__compiled__[self.__schemas__[alias]]) {
              return;
            }
            self.__compiled__[alias].validate = self.__compiled__[self.__schemas__[alias]].validate;
            self.__compiled__[alias].normalize = self.__compiled__[self.__schemas__[alias]].normalize;
          });
          self.__compiled__[""] = { validate: null, normalize: createNormalizer() };
          var slist = Object.keys(self.__compiled__).filter(function(name) {
            return name.length > 0 && self.__compiled__[name];
          }).map(escapeRE).join("|");
          self.re.schema_test = RegExp("(^|(?!_)(?:[><\uFF5C]|" + re.src_ZPCc + "))(" + slist + ")", "i");
          self.re.schema_search = RegExp("(^|(?!_)(?:[><\uFF5C]|" + re.src_ZPCc + "))(" + slist + ")", "ig");
          self.re.pretest = RegExp("(" + self.re.schema_test.source + ")|(" + self.re.host_fuzzy_test.source + ")|@", "i");
          resetScanCache(self);
        }
        __name(compile, "compile");
        function Match(self, shift) {
          var start = self.__index__, end = self.__last_index__, text22 = self.__text_cache__.slice(start, end);
          this.schema = self.__schema__.toLowerCase();
          this.index = start + shift;
          this.lastIndex = end + shift;
          this.raw = text22;
          this.text = text22;
          this.url = text22;
        }
        __name(Match, "Match");
        function createMatch(self, shift) {
          var match2 = new Match(self, shift);
          self.__compiled__[match2.schema].normalize(match2, self);
          return match2;
        }
        __name(createMatch, "createMatch");
        function LinkifyIt(schemas, options) {
          if (!(this instanceof LinkifyIt)) {
            return new LinkifyIt(schemas, options);
          }
          if (!options) {
            if (isOptionsObj(schemas)) {
              options = schemas;
              schemas = {};
            }
          }
          this.__opts__ = assign({}, defaultOptions, options);
          this.__index__ = -1;
          this.__last_index__ = -1;
          this.__schema__ = "";
          this.__text_cache__ = "";
          this.__schemas__ = assign({}, defaultSchemas, schemas);
          this.__compiled__ = {};
          this.__tlds__ = tlds_default;
          this.__tlds_replaced__ = false;
          this.re = {};
          compile(this);
        }
        __name(LinkifyIt, "LinkifyIt");
        LinkifyIt.prototype.add = /* @__PURE__ */ __name(function add(schema, definition) {
          this.__schemas__[schema] = definition;
          compile(this);
          return this;
        }, "add");
        LinkifyIt.prototype.set = /* @__PURE__ */ __name(function set(options) {
          this.__opts__ = assign(this.__opts__, options);
          return this;
        }, "set");
        LinkifyIt.prototype.test = /* @__PURE__ */ __name(function test(text22) {
          this.__text_cache__ = text22;
          this.__index__ = -1;
          if (!text22.length) {
            return false;
          }
          var m, ml, me, len, shift, next, re, tld_pos, at_pos;
          if (this.re.schema_test.test(text22)) {
            re = this.re.schema_search;
            re.lastIndex = 0;
            while ((m = re.exec(text22)) !== null) {
              len = this.testSchemaAt(text22, m[2], re.lastIndex);
              if (len) {
                this.__schema__ = m[2];
                this.__index__ = m.index + m[1].length;
                this.__last_index__ = m.index + m[0].length + len;
                break;
              }
            }
          }
          if (this.__opts__.fuzzyLink && this.__compiled__["http:"]) {
            tld_pos = text22.search(this.re.host_fuzzy_test);
            if (tld_pos >= 0) {
              if (this.__index__ < 0 || tld_pos < this.__index__) {
                if ((ml = text22.match(this.__opts__.fuzzyIP ? this.re.link_fuzzy : this.re.link_no_ip_fuzzy)) !== null) {
                  shift = ml.index + ml[1].length;
                  if (this.__index__ < 0 || shift < this.__index__) {
                    this.__schema__ = "";
                    this.__index__ = shift;
                    this.__last_index__ = ml.index + ml[0].length;
                  }
                }
              }
            }
          }
          if (this.__opts__.fuzzyEmail && this.__compiled__["mailto:"]) {
            at_pos = text22.indexOf("@");
            if (at_pos >= 0) {
              if ((me = text22.match(this.re.email_fuzzy)) !== null) {
                shift = me.index + me[1].length;
                next = me.index + me[0].length;
                if (this.__index__ < 0 || shift < this.__index__ || shift === this.__index__ && next > this.__last_index__) {
                  this.__schema__ = "mailto:";
                  this.__index__ = shift;
                  this.__last_index__ = next;
                }
              }
            }
          }
          return this.__index__ >= 0;
        }, "test");
        LinkifyIt.prototype.pretest = /* @__PURE__ */ __name(function pretest(text22) {
          return this.re.pretest.test(text22);
        }, "pretest");
        LinkifyIt.prototype.testSchemaAt = /* @__PURE__ */ __name(function testSchemaAt(text22, schema, pos) {
          if (!this.__compiled__[schema.toLowerCase()]) {
            return 0;
          }
          return this.__compiled__[schema.toLowerCase()].validate(text22, pos, this);
        }, "testSchemaAt");
        LinkifyIt.prototype.match = /* @__PURE__ */ __name(function match2(text22) {
          var shift = 0, result = [];
          if (this.__index__ >= 0 && this.__text_cache__ === text22) {
            result.push(createMatch(this, shift));
            shift = this.__last_index__;
          }
          var tail = shift ? text22.slice(shift) : text22;
          while (this.test(tail)) {
            result.push(createMatch(this, shift));
            tail = tail.slice(this.__last_index__);
            shift += this.__last_index__;
          }
          if (result.length) {
            return result;
          }
          return null;
        }, "match");
        LinkifyIt.prototype.tlds = /* @__PURE__ */ __name(function tlds(list2, keepOld) {
          list2 = Array.isArray(list2) ? list2 : [list2];
          if (!keepOld) {
            this.__tlds__ = list2.slice();
            this.__tlds_replaced__ = true;
            compile(this);
            return this;
          }
          this.__tlds__ = this.__tlds__.concat(list2).sort().filter(function(el, idx, arr) {
            return el !== arr[idx - 1];
          }).reverse();
          compile(this);
          return this;
        }, "tlds");
        LinkifyIt.prototype.normalize = /* @__PURE__ */ __name(function normalize(match2) {
          if (!match2.schema) {
            match2.url = "http://" + match2.url;
          }
          if (match2.schema === "mailto:" && !/^mailto:/i.test(match2.url)) {
            match2.url = "mailto:" + match2.url;
          }
        }, "normalize");
        LinkifyIt.prototype.onCompile = /* @__PURE__ */ __name(function onCompile() {
        }, "onCompile");
        module.exports = LinkifyIt;
      }
    });
    require_punycode = __commonJS2({
      "node_modules/punycode/punycode.js"(exports, module) {
        "use strict";
        var maxInt = 2147483647;
        var base = 36;
        var tMin = 1;
        var tMax = 26;
        var skew = 38;
        var damp = 700;
        var initialBias = 72;
        var initialN = 128;
        var delimiter = "-";
        var regexPunycode = /^xn--/;
        var regexNonASCII = /[^\0-\x7E]/;
        var regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g;
        var errors = {
          "overflow": "Overflow: input needs wider integers to process",
          "not-basic": "Illegal input >= 0x80 (not a basic code point)",
          "invalid-input": "Invalid input"
        };
        var baseMinusTMin = base - tMin;
        var floor = Math.floor;
        var stringFromCharCode = String.fromCharCode;
        function error2(type2) {
          throw new RangeError(errors[type2]);
        }
        __name(error2, "error2");
        function map(array2, fn) {
          const result = [];
          let length = array2.length;
          while (length--) {
            result[length] = fn(array2[length]);
          }
          return result;
        }
        __name(map, "map");
        function mapDomain(string2, fn) {
          const parts = string2.split("@");
          let result = "";
          if (parts.length > 1) {
            result = parts[0] + "@";
            string2 = parts[1];
          }
          string2 = string2.replace(regexSeparators, ".");
          const labels = string2.split(".");
          const encoded = map(labels, fn).join(".");
          return result + encoded;
        }
        __name(mapDomain, "mapDomain");
        function ucs2decode(string2) {
          const output = [];
          let counter = 0;
          const length = string2.length;
          while (counter < length) {
            const value = string2.charCodeAt(counter++);
            if (value >= 55296 && value <= 56319 && counter < length) {
              const extra = string2.charCodeAt(counter++);
              if ((extra & 64512) == 56320) {
                output.push(((value & 1023) << 10) + (extra & 1023) + 65536);
              } else {
                output.push(value);
                counter--;
              }
            } else {
              output.push(value);
            }
          }
          return output;
        }
        __name(ucs2decode, "ucs2decode");
        var ucs2encode = /* @__PURE__ */ __name((array2) => String.fromCodePoint(...array2), "ucs2encode");
        var basicToDigit = /* @__PURE__ */ __name(function(codePoint) {
          if (codePoint - 48 < 10) {
            return codePoint - 22;
          }
          if (codePoint - 65 < 26) {
            return codePoint - 65;
          }
          if (codePoint - 97 < 26) {
            return codePoint - 97;
          }
          return base;
        }, "basicToDigit");
        var digitToBasic = /* @__PURE__ */ __name(function(digit, flag) {
          return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
        }, "digitToBasic");
        var adapt = /* @__PURE__ */ __name(function(delta, numPoints, firstTime) {
          let k = 0;
          delta = firstTime ? floor(delta / damp) : delta >> 1;
          delta += floor(delta / numPoints);
          for (; delta > baseMinusTMin * tMax >> 1; k += base) {
            delta = floor(delta / baseMinusTMin);
          }
          return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
        }, "adapt");
        var decode = /* @__PURE__ */ __name(function(input) {
          const output = [];
          const inputLength = input.length;
          let i = 0;
          let n = initialN;
          let bias = initialBias;
          let basic = input.lastIndexOf(delimiter);
          if (basic < 0) {
            basic = 0;
          }
          for (let j = 0; j < basic; ++j) {
            if (input.charCodeAt(j) >= 128) {
              error2("not-basic");
            }
            output.push(input.charCodeAt(j));
          }
          for (let index2 = basic > 0 ? basic + 1 : 0; index2 < inputLength; ) {
            let oldi = i;
            for (let w = 1, k = base; ; k += base) {
              if (index2 >= inputLength) {
                error2("invalid-input");
              }
              const digit = basicToDigit(input.charCodeAt(index2++));
              if (digit >= base || digit > floor((maxInt - i) / w)) {
                error2("overflow");
              }
              i += digit * w;
              const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
              if (digit < t) {
                break;
              }
              const baseMinusT = base - t;
              if (w > floor(maxInt / baseMinusT)) {
                error2("overflow");
              }
              w *= baseMinusT;
            }
            const out = output.length + 1;
            bias = adapt(i - oldi, out, oldi == 0);
            if (floor(i / out) > maxInt - n) {
              error2("overflow");
            }
            n += floor(i / out);
            i %= out;
            output.splice(i++, 0, n);
          }
          return String.fromCodePoint(...output);
        }, "decode");
        var encode = /* @__PURE__ */ __name(function(input) {
          const output = [];
          input = ucs2decode(input);
          let inputLength = input.length;
          let n = initialN;
          let delta = 0;
          let bias = initialBias;
          for (const currentValue of input) {
            if (currentValue < 128) {
              output.push(stringFromCharCode(currentValue));
            }
          }
          let basicLength = output.length;
          let handledCPCount = basicLength;
          if (basicLength) {
            output.push(delimiter);
          }
          while (handledCPCount < inputLength) {
            let m = maxInt;
            for (const currentValue of input) {
              if (currentValue >= n && currentValue < m) {
                m = currentValue;
              }
            }
            const handledCPCountPlusOne = handledCPCount + 1;
            if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
              error2("overflow");
            }
            delta += (m - n) * handledCPCountPlusOne;
            n = m;
            for (const currentValue of input) {
              if (currentValue < n && ++delta > maxInt) {
                error2("overflow");
              }
              if (currentValue == n) {
                let q = delta;
                for (let k = base; ; k += base) {
                  const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
                  if (q < t) {
                    break;
                  }
                  const qMinusT = q - t;
                  const baseMinusT = base - t;
                  output.push(stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0)));
                  q = floor(qMinusT / baseMinusT);
                }
                output.push(stringFromCharCode(digitToBasic(q, 0)));
                bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
                delta = 0;
                ++handledCPCount;
              }
            }
            ++delta;
            ++n;
          }
          return output.join("");
        }, "encode");
        var toUnicode = /* @__PURE__ */ __name(function(input) {
          return mapDomain(input, function(string2) {
            return regexPunycode.test(string2) ? decode(string2.slice(4).toLowerCase()) : string2;
          });
        }, "toUnicode");
        var toASCII = /* @__PURE__ */ __name(function(input) {
          return mapDomain(input, function(string2) {
            return regexNonASCII.test(string2) ? "xn--" + encode(string2) : string2;
          });
        }, "toASCII");
        var punycode = {
          "version": "2.1.0",
          "ucs2": {
            "decode": ucs2decode,
            "encode": ucs2encode
          },
          "decode": decode,
          "encode": encode,
          "toASCII": toASCII,
          "toUnicode": toUnicode
        };
        module.exports = punycode;
      }
    });
    require_default = __commonJS2({
      "node_modules/markdown-it/lib/presets/default.js"(exports, module) {
        "use strict";
        module.exports = {
          options: {
            html: false,
            xhtmlOut: false,
            breaks: false,
            langPrefix: "language-",
            linkify: false,
            typographer: false,
            quotes: "\u201C\u201D\u2018\u2019",
            highlight: null,
            maxNesting: 100
          },
          components: {
            core: {},
            block: {},
            inline: {}
          }
        };
      }
    });
    require_zero = __commonJS2({
      "node_modules/markdown-it/lib/presets/zero.js"(exports, module) {
        "use strict";
        module.exports = {
          options: {
            html: false,
            xhtmlOut: false,
            breaks: false,
            langPrefix: "language-",
            linkify: false,
            typographer: false,
            quotes: "\u201C\u201D\u2018\u2019",
            highlight: null,
            maxNesting: 20
          },
          components: {
            core: {
              rules: [
                "normalize",
                "block",
                "inline"
              ]
            },
            block: {
              rules: [
                "paragraph"
              ]
            },
            inline: {
              rules: [
                "text"
              ],
              rules2: [
                "balance_pairs",
                "text_collapse"
              ]
            }
          }
        };
      }
    });
    require_commonmark = __commonJS2({
      "node_modules/markdown-it/lib/presets/commonmark.js"(exports, module) {
        "use strict";
        module.exports = {
          options: {
            html: true,
            xhtmlOut: true,
            breaks: false,
            langPrefix: "language-",
            linkify: false,
            typographer: false,
            quotes: "\u201C\u201D\u2018\u2019",
            highlight: null,
            maxNesting: 20
          },
          components: {
            core: {
              rules: [
                "normalize",
                "block",
                "inline"
              ]
            },
            block: {
              rules: [
                "blockquote",
                "code",
                "fence",
                "heading",
                "hr",
                "html_block",
                "lheading",
                "list",
                "reference",
                "paragraph"
              ]
            },
            inline: {
              rules: [
                "autolink",
                "backticks",
                "emphasis",
                "entity",
                "escape",
                "html_inline",
                "image",
                "link",
                "newline",
                "text"
              ],
              rules2: [
                "balance_pairs",
                "emphasis",
                "text_collapse"
              ]
            }
          }
        };
      }
    });
    require_lib = __commonJS2({
      "node_modules/markdown-it/lib/index.js"(exports, module) {
        "use strict";
        var utils = require_utils();
        var helpers = require_helpers();
        var Renderer = require_renderer();
        var ParserCore = require_parser_core();
        var ParserBlock = require_parser_block();
        var ParserInline = require_parser_inline();
        var LinkifyIt = require_linkify_it();
        var mdurl = require_mdurl();
        var punycode = require_punycode();
        var config2 = {
          default: require_default(),
          zero: require_zero(),
          commonmark: require_commonmark()
        };
        var BAD_PROTO_RE = /^(vbscript|javascript|file|data):/;
        var GOOD_DATA_RE = /^data:image\/(gif|png|jpeg|webp);/;
        function validateLink(url2) {
          var str = url2.trim().toLowerCase();
          return BAD_PROTO_RE.test(str) ? GOOD_DATA_RE.test(str) ? true : false : true;
        }
        __name(validateLink, "validateLink");
        var RECODE_HOSTNAME_FOR = ["http:", "https:", "mailto:"];
        function normalizeLink(url2) {
          var parsed = mdurl.parse(url2, true);
          if (parsed.hostname) {
            if (!parsed.protocol || RECODE_HOSTNAME_FOR.indexOf(parsed.protocol) >= 0) {
              try {
                parsed.hostname = punycode.toASCII(parsed.hostname);
              } catch (er) {
              }
            }
          }
          return mdurl.encode(mdurl.format(parsed));
        }
        __name(normalizeLink, "normalizeLink");
        function normalizeLinkText(url2) {
          var parsed = mdurl.parse(url2, true);
          if (parsed.hostname) {
            if (!parsed.protocol || RECODE_HOSTNAME_FOR.indexOf(parsed.protocol) >= 0) {
              try {
                parsed.hostname = punycode.toUnicode(parsed.hostname);
              } catch (er) {
              }
            }
          }
          return mdurl.decode(mdurl.format(parsed), mdurl.decode.defaultChars + "%");
        }
        __name(normalizeLinkText, "normalizeLinkText");
        function MarkdownIt3(presetName, options) {
          if (!(this instanceof MarkdownIt3)) {
            return new MarkdownIt3(presetName, options);
          }
          if (!options) {
            if (!utils.isString(presetName)) {
              options = presetName || {};
              presetName = "default";
            }
          }
          this.inline = new ParserInline();
          this.block = new ParserBlock();
          this.core = new ParserCore();
          this.renderer = new Renderer();
          this.linkify = new LinkifyIt();
          this.validateLink = validateLink;
          this.normalizeLink = normalizeLink;
          this.normalizeLinkText = normalizeLinkText;
          this.utils = utils;
          this.helpers = utils.assign({}, helpers);
          this.options = {};
          this.configure(presetName);
          if (options) {
            this.set(options);
          }
        }
        __name(MarkdownIt3, "MarkdownIt3");
        MarkdownIt3.prototype.set = function(options) {
          utils.assign(this.options, options);
          return this;
        };
        MarkdownIt3.prototype.configure = function(presets) {
          var self = this, presetName;
          if (utils.isString(presets)) {
            presetName = presets;
            presets = config2[presetName];
            if (!presets) {
              throw new Error('Wrong `markdown-it` preset "' + presetName + '", check name');
            }
          }
          if (!presets) {
            throw new Error("Wrong `markdown-it` preset, can't be empty");
          }
          if (presets.options) {
            self.set(presets.options);
          }
          if (presets.components) {
            Object.keys(presets.components).forEach(function(name) {
              if (presets.components[name].rules) {
                self[name].ruler.enableOnly(presets.components[name].rules);
              }
              if (presets.components[name].rules2) {
                self[name].ruler2.enableOnly(presets.components[name].rules2);
              }
            });
          }
          return this;
        };
        MarkdownIt3.prototype.enable = function(list2, ignoreInvalid) {
          var result = [];
          if (!Array.isArray(list2)) {
            list2 = [list2];
          }
          ["core", "block", "inline"].forEach(function(chain) {
            result = result.concat(this[chain].ruler.enable(list2, true));
          }, this);
          result = result.concat(this.inline.ruler2.enable(list2, true));
          var missed = list2.filter(function(name) {
            return result.indexOf(name) < 0;
          });
          if (missed.length && !ignoreInvalid) {
            throw new Error("MarkdownIt. Failed to enable unknown rule(s): " + missed);
          }
          return this;
        };
        MarkdownIt3.prototype.disable = function(list2, ignoreInvalid) {
          var result = [];
          if (!Array.isArray(list2)) {
            list2 = [list2];
          }
          ["core", "block", "inline"].forEach(function(chain) {
            result = result.concat(this[chain].ruler.disable(list2, true));
          }, this);
          result = result.concat(this.inline.ruler2.disable(list2, true));
          var missed = list2.filter(function(name) {
            return result.indexOf(name) < 0;
          });
          if (missed.length && !ignoreInvalid) {
            throw new Error("MarkdownIt. Failed to disable unknown rule(s): " + missed);
          }
          return this;
        };
        MarkdownIt3.prototype.use = function(plugin4) {
          var args = [this].concat(Array.prototype.slice.call(arguments, 1));
          plugin4.apply(plugin4, args);
          return this;
        };
        MarkdownIt3.prototype.parse = function(src, env) {
          if (typeof src !== "string") {
            throw new Error("Input data should be a String");
          }
          var state = new this.core.State(src, this, env);
          this.core.process(state);
          return state.tokens;
        };
        MarkdownIt3.prototype.render = function(src, env) {
          env = env || {};
          return this.renderer.render(this.parse(src, env), this.options, env);
        };
        MarkdownIt3.prototype.parseInline = function(src, env) {
          var state = new this.core.State(src, this, env);
          state.inlineMode = true;
          this.core.process(state);
          return state.tokens;
        };
        MarkdownIt3.prototype.renderInline = function(src, env) {
          env = env || {};
          return this.renderer.render(this.parseInline(src, env), this.options, env);
        };
        module.exports = MarkdownIt3;
      }
    });
    require_markdown_it = __commonJS2({
      "node_modules/markdown-it/index.js"(exports, module) {
        "use strict";
        module.exports = require_lib();
      }
    });
    base_exports = {};
    __export(base_exports, {
      getAstValues: /* @__PURE__ */ __name(() => getAstValues, "getAstValues"),
      isAst: /* @__PURE__ */ __name(() => isAst, "isAst"),
      isFunction: /* @__PURE__ */ __name(() => isFunction, "isFunction"),
      isVariable: /* @__PURE__ */ __name(() => isVariable, "isVariable"),
      resolve: /* @__PURE__ */ __name(() => resolve, "resolve")
    });
    __name(isAst, "isAst");
    __name(isFunction, "isFunction");
    __name(isVariable, "isVariable");
    __name(getAstValues, "getAstValues");
    __name(resolve, "resolve");
    Tag = class {
      static {
        __name(this, "Tag");
      }
      constructor(name = "div", attributes = {}, children = []) {
        this.$$mdtype = "Tag";
        this.name = name;
        this.attributes = attributes;
        this.children = children;
      }
    };
    Tag.isTag = (tag) => {
      return !!(tag?.$$mdtype === "Tag");
    };
    Class = class {
      static {
        __name(this, "Class");
      }
      validate(value, _config, key) {
        if (typeof value === "string" || typeof value === "object")
          return [];
        return [
          {
            id: "attribute-type-invalid",
            level: "error",
            message: `Attribute '${key}' must be type 'string | object'`
          }
        ];
      }
      transform(value) {
        if (!value || typeof value === "string")
          return value;
        const classes = [];
        for (const [k, v] of Object.entries(value ?? {}))
          if (v)
            classes.push(k);
        return classes.join(" ");
      }
    };
    Id = class {
      static {
        __name(this, "Id");
      }
      validate(value) {
        if (typeof value === "string" && value.match(/^[a-zA-Z]/))
          return [];
        return [
          {
            id: "attribute-value-invalid",
            level: "error",
            message: "The 'id' attribute must start with a letter"
          }
        ];
      }
    };
    import_tag = __toModule(require_tag());
    Variable = class {
      static {
        __name(this, "Variable");
      }
      constructor(path = []) {
        this.$$mdtype = "Variable";
        this.path = path;
      }
      resolve({ variables } = {}) {
        return variables instanceof Function ? variables(this.path) : this.path.reduce((obj = {}, key) => obj[key], variables);
      }
    };
    Function2 = class {
      static {
        __name(this, "Function2");
      }
      constructor(name, parameters) {
        this.$$mdtype = "Function";
        this.name = name;
        this.parameters = parameters;
      }
      resolve(config2 = {}) {
        const fn = config2?.functions?.[this.name];
        if (!fn)
          return null;
        const parameters = resolve(this.parameters, config2);
        return fn.transform?.(parameters, config2);
      }
    };
    (function(STATES2) {
      STATES2[STATES2["normal"] = 0] = "normal";
      STATES2[STATES2["string"] = 1] = "string";
      STATES2[STATES2["escape"] = 2] = "escape";
    })(STATES || (STATES = {}));
    OPEN = "{%";
    CLOSE = "%}";
    IDENTIFIER_REGEX = /^[a-zA-Z0-9_-]+$/;
    __name(isIdentifier, "isIdentifier");
    __name(isPromise, "isPromise");
    __name(findTagEnd, "findTagEnd");
    __name(parseTag, "parseTag");
    __name(parseTags, "parseTags");
    globalAttributes = {
      class: { type: Class, render: true },
      id: { type: Id, render: true }
    };
    transformer_default = {
      findSchema(node2, { nodes = {}, tags = {} } = {}) {
        return node2.tag ? tags[node2.tag] : nodes[node2.type];
      },
      attributes(node2, config2 = {}) {
        const schema = this.findSchema(node2, config2) ?? {};
        const output = {};
        const attrs = { ...globalAttributes, ...schema.attributes };
        for (const [key, attr] of Object.entries(attrs)) {
          if (attr.render == false)
            continue;
          const name = typeof attr.render === "string" ? attr.render : key;
          let value = node2.attributes[key];
          if (typeof attr.type === "function") {
            const instance = new attr.type();
            if (instance.transform) {
              value = instance.transform(value, config2);
            }
          }
          value = value === void 0 ? attr.default : value;
          if (value === void 0)
            continue;
          output[name] = value;
        }
        if (schema.slots) {
          for (const [key, slot2] of Object.entries(schema.slots)) {
            if (slot2.render === false)
              continue;
            const name = typeof slot2.render === "string" ? slot2.render : key;
            if (node2.slots[key])
              output[name] = this.node(node2.slots[key], config2);
          }
        }
        return output;
      },
      children(node2, config2 = {}) {
        const children = node2.children.flatMap((child2) => this.node(child2, config2));
        if (children.some(isPromise)) {
          return Promise.all(children);
        }
        return children;
      },
      node(node2, config2 = {}) {
        const schema = this.findSchema(node2, config2) ?? {};
        if (schema && schema.transform instanceof Function)
          return schema.transform(node2, config2);
        const children = this.children(node2, config2);
        if (!schema || !schema.render)
          return children;
        const attributes = this.attributes(node2, config2);
        if (isPromise(attributes) || isPromise(children)) {
          return Promise.all([attributes, children]).then((values) => new Tag(schema.render, ...values));
        }
        return new Tag(schema.render, attributes, children);
      }
    };
    Node = class {
      static {
        __name(this, "Node");
      }
      constructor(type2 = "node", attributes = {}, children = [], tag) {
        this.$$mdtype = "Node";
        this.errors = [];
        this.lines = [];
        this.inline = false;
        this.attributes = attributes;
        this.children = children;
        this.type = type2;
        this.tag = tag;
        this.annotations = [];
        this.slots = {};
      }
      *walk() {
        for (const child2 of [...Object.values(this.slots), ...this.children]) {
          yield child2;
          yield* child2.walk();
        }
      }
      push(node2) {
        this.children.push(node2);
      }
      resolve(config2 = {}) {
        return Object.assign(new Node(), this, {
          children: this.children.map((child2) => child2.resolve(config2)),
          attributes: resolve(this.attributes, config2),
          slots: Object.fromEntries(Object.entries(this.slots).map(([name, slot2]) => [
            name,
            slot2.resolve(config2)
          ]))
        });
      }
      findSchema(config2 = {}) {
        return transformer_default.findSchema(this, config2);
      }
      transformAttributes(config2 = {}) {
        return transformer_default.attributes(this, config2);
      }
      transformChildren(config2) {
        return transformer_default.children(this, config2);
      }
      transform(config2) {
        return transformer_default.node(this, config2);
      }
    };
    AstTypes = {
      Function: Function2,
      Node,
      Variable
    };
    __name(reviver, "reviver");
    __name(fromJSON, "fromJSON");
    ast_default = {
      ...AstTypes,
      ...base_exports,
      fromJSON
    };
    SPACE = " ";
    SEP = ", ";
    NL = "\n";
    OL = ".";
    UL = "-";
    MAX_TAG_OPENING_WIDTH = 80;
    WRAPPING_TYPES = ["strong", "em", "s"];
    max = /* @__PURE__ */ __name((a, b) => Math.max(a, b), "max");
    increment = /* @__PURE__ */ __name((o, n = 2) => ({
      ...o,
      indent: (o.indent || 0) + n
    }), "increment");
    __name(formatChildren, "formatChildren");
    __name(formatInline, "formatInline");
    __name(formatTableRow, "formatTableRow");
    __name(formatScalar, "formatScalar");
    __name(formatAnnotationValue, "formatAnnotationValue");
    __name(formatAttributes, "formatAttributes");
    __name(formatAnnotations, "formatAnnotations");
    __name(formatVariable, "formatVariable");
    __name(formatFunction, "formatFunction");
    __name(trimStart, "trimStart");
    __name(escapeMarkdownCharacters, "escapeMarkdownCharacters");
    __name(formatNode, "formatNode");
    __name(formatValue, "formatValue");
    __name(format, "format");
    __name(truthy, "truthy");
    __name(renderConditions, "renderConditions");
    tagIf = {
      attributes: {
        primary: { type: Object, render: false }
      },
      transform(node2, config2) {
        const conditions = renderConditions(node2);
        for (const { condition, children } of conditions)
          if (truthy(condition)) {
            const nodes = children.flatMap((child2) => child2.transform(config2));
            if (nodes.some(isPromise)) {
              return Promise.all(nodes).then((nodes2) => nodes2.flat());
            }
            return nodes;
          }
        return [];
      }
    };
    tagElse = {
      selfClosing: true,
      attributes: {
        primary: { type: Object, render: false }
      }
    };
    and = {
      transform(parameters) {
        return Object.values(parameters).every((x) => truthy(x));
      }
    };
    or = {
      transform(parameters) {
        return Object.values(parameters).find((x) => truthy(x)) !== void 0;
      }
    };
    not = {
      parameters: {
        0: { required: true }
      },
      transform(parameters) {
        return !truthy(parameters[0]);
      }
    };
    equals = {
      transform(parameters) {
        const values = Object.values(parameters);
        return values.every((v) => v === values[0]);
      }
    };
    debug = {
      transform(parameters) {
        return JSON.stringify(parameters[0], null, 2);
      }
    };
    defaultFn = {
      transform(parameters) {
        return parameters[0] === void 0 ? parameters[1] : parameters[0];
      }
    };
    functions_default = { and, or, not, equals, default: defaultFn, debug };
    __name(convertToRow, "convertToRow");
    __name(transform, "transform");
    transforms_default = [transform];
    mappings = {
      ordered_list: "list",
      bullet_list: "list",
      code_inline: "code",
      list_item: "item",
      variable: "text"
    };
    __name(annotate, "annotate");
    __name(handleAttrs, "handleAttrs");
    __name(handleToken, "handleToken");
    __name(parser, "parser");
    schema_exports = {};
    __export(schema_exports, {
      blockquote: /* @__PURE__ */ __name(() => blockquote, "blockquote"),
      code: /* @__PURE__ */ __name(() => code, "code"),
      comment: /* @__PURE__ */ __name(() => comment, "comment"),
      document: /* @__PURE__ */ __name(() => document, "document"),
      em: /* @__PURE__ */ __name(() => em, "em"),
      error: /* @__PURE__ */ __name(() => error, "error"),
      fence: /* @__PURE__ */ __name(() => fence, "fence"),
      hardbreak: /* @__PURE__ */ __name(() => hardbreak, "hardbreak"),
      heading: /* @__PURE__ */ __name(() => heading, "heading"),
      hr: /* @__PURE__ */ __name(() => hr, "hr"),
      image: /* @__PURE__ */ __name(() => image, "image"),
      inline: /* @__PURE__ */ __name(() => inline, "inline"),
      item: /* @__PURE__ */ __name(() => item, "item"),
      link: /* @__PURE__ */ __name(() => link, "link"),
      list: /* @__PURE__ */ __name(() => list, "list"),
      node: /* @__PURE__ */ __name(() => node, "node"),
      paragraph: /* @__PURE__ */ __name(() => paragraph, "paragraph"),
      s: /* @__PURE__ */ __name(() => s, "s"),
      softbreak: /* @__PURE__ */ __name(() => softbreak, "softbreak"),
      strong: /* @__PURE__ */ __name(() => strong, "strong"),
      table: /* @__PURE__ */ __name(() => table, "table"),
      tbody: /* @__PURE__ */ __name(() => tbody, "tbody"),
      td: /* @__PURE__ */ __name(() => td, "td"),
      text: /* @__PURE__ */ __name(() => text, "text"),
      th: /* @__PURE__ */ __name(() => th, "th"),
      thead: /* @__PURE__ */ __name(() => thead, "thead"),
      tr: /* @__PURE__ */ __name(() => tr, "tr")
    });
    document = {
      render: "article",
      children: [
        "heading",
        "paragraph",
        "image",
        "table",
        "tag",
        "fence",
        "blockquote",
        "comment",
        "list",
        "hr"
      ],
      attributes: {
        frontmatter: { render: false }
      }
    };
    heading = {
      children: ["inline"],
      attributes: {
        level: { type: Number, render: false, required: true }
      },
      transform(node2, config2) {
        return new Tag(`h${node2.attributes["level"]}`, node2.transformAttributes(config2), node2.transformChildren(config2));
      }
    };
    paragraph = {
      render: "p",
      children: ["inline"]
    };
    image = {
      render: "img",
      attributes: {
        src: { type: String, required: true },
        alt: { type: String },
        title: { type: String }
      }
    };
    fence = {
      render: "pre",
      attributes: {
        content: { type: String, render: false, required: true },
        language: { type: String, render: "data-language" },
        process: { type: Boolean, render: false, default: true }
      },
      transform(node2, config2) {
        const attributes = node2.transformAttributes(config2);
        const children = node2.children.length ? node2.transformChildren(config2) : [node2.attributes.content];
        return new Tag("pre", attributes, children);
      }
    };
    blockquote = {
      render: "blockquote",
      children: [
        "heading",
        "paragraph",
        "image",
        "table",
        "tag",
        "fence",
        "blockquote",
        "list",
        "hr"
      ]
    };
    item = {
      render: "li",
      children: [
        "inline",
        "heading",
        "paragraph",
        "image",
        "table",
        "tag",
        "fence",
        "blockquote",
        "list",
        "hr"
      ]
    };
    list = {
      children: ["item"],
      attributes: {
        ordered: { type: Boolean, render: false, required: true },
        start: { type: Number },
        marker: { type: String, render: false }
      },
      transform(node2, config2) {
        return new Tag(node2.attributes.ordered ? "ol" : "ul", node2.transformAttributes(config2), node2.transformChildren(config2));
      }
    };
    hr = {
      render: "hr"
    };
    table = {
      render: "table"
    };
    td = {
      render: "td",
      children: [
        "inline",
        "heading",
        "paragraph",
        "image",
        "table",
        "tag",
        "fence",
        "blockquote",
        "list",
        "hr"
      ],
      attributes: {
        align: { type: String },
        colspan: { type: Number, render: "colSpan" },
        rowspan: { type: Number, render: "rowSpan" }
      }
    };
    th = {
      render: "th",
      attributes: {
        width: { type: String },
        align: { type: String },
        colspan: { type: Number, render: "colSpan" },
        rowspan: { type: Number, render: "rowSpan" }
      }
    };
    tr = {
      render: "tr",
      children: ["th", "td"]
    };
    tbody = {
      render: "tbody",
      children: ["tr", "tag"]
    };
    thead = {
      render: "thead",
      children: ["tr"]
    };
    strong = {
      render: "strong",
      children: ["em", "s", "link", "code", "text", "tag"],
      attributes: {
        marker: { type: String, render: false }
      }
    };
    em = {
      render: "em",
      children: ["strong", "s", "link", "code", "text", "tag"],
      attributes: {
        marker: { type: String, render: false }
      }
    };
    s = {
      render: "s",
      children: ["strong", "em", "link", "code", "text", "tag"]
    };
    inline = {
      children: [
        "strong",
        "em",
        "s",
        "code",
        "text",
        "tag",
        "link",
        "image",
        "hardbreak",
        "softbreak",
        "comment"
      ]
    };
    link = {
      render: "a",
      children: ["strong", "em", "s", "code", "text", "tag"],
      attributes: {
        href: { type: String, required: true },
        title: { type: String }
      }
    };
    code = {
      render: "code",
      attributes: {
        content: { type: String, render: false, required: true }
      },
      transform(node2, config2) {
        const attributes = node2.transformAttributes(config2);
        return new Tag("code", attributes, [node2.attributes.content]);
      }
    };
    text = {
      attributes: {
        content: { type: String, required: true }
      },
      transform(node2) {
        return node2.attributes.content;
      }
    };
    hardbreak = {
      render: "br"
    };
    softbreak = {
      transform() {
        return " ";
      }
    };
    comment = {
      attributes: {
        content: { type: String, required: true }
      }
    };
    error = {};
    node = {};
    import_markdown_it = __toModule(require_markdown_it());
    ({ escapeHtml } = (0, import_markdown_it.default)().utils);
    voidElements = /* @__PURE__ */ new Set([
      "area",
      "base",
      "br",
      "col",
      "embed",
      "hr",
      "img",
      "input",
      "link",
      "meta",
      "param",
      "source",
      "track",
      "wbr"
    ]);
    __name(render, "render");
    __name(tagName, "tagName");
    __name(dynamic, "dynamic");
    __name(tagName2, "tagName2");
    __name(renderArray, "renderArray");
    __name(deepRender, "deepRender");
    __name(render2, "render2");
    __name(reactStatic, "reactStatic");
    renderers_default = { html: render, react: dynamic, reactStatic };
    PartialFile = class {
      static {
        __name(this, "PartialFile");
      }
      validate(file2, config2) {
        const { partials = {} } = config2;
        const partial2 = partials[file2];
        if (!partial2)
          return [
            {
              id: "attribute-value-invalid",
              level: "error",
              message: `Partial \`${file2}\` not found. The 'file' attribute must be set in \`config.partials\``
            }
          ];
        return [];
      }
    };
    partial = {
      inline: false,
      selfClosing: true,
      attributes: {
        file: { type: PartialFile, render: false, required: true },
        variables: { type: Object, render: false }
      },
      transform(node2, config2) {
        const { partials = {} } = config2;
        const { file: file2, variables } = node2.attributes;
        const partial2 = partials[file2];
        if (!partial2)
          return null;
        const scopedConfig = {
          ...config2,
          variables: {
            ...config2.variables,
            ...variables,
            ["$$partial:filename"]: file2
          }
        };
        const transformChildren = /* @__PURE__ */ __name((part) => part.resolve(scopedConfig).transformChildren(scopedConfig), "transformChildren");
        return Array.isArray(partial2) ? partial2.flatMap(transformChildren) : transformChildren(partial2);
      }
    };
    table2 = {
      children: ["table"],
      inline: false
    };
    slot = {
      attributes: {
        primary: { type: String, required: true }
      }
    };
    tags_default = {
      else: tagElse,
      if: tagIf,
      partial,
      slot,
      table: table2
    };
    import_lib = __toModule(require_lib());
    import_tag7 = __toModule(require_tag());
    __name(createToken, "createToken");
    __name(block, "block");
    __name(inline2, "inline2");
    __name(core, "core");
    __name(plugin, "plugin");
    fence2 = "---";
    __name(getLine, "getLine");
    __name(findClose, "findClose");
    __name(block2, "block2");
    __name(plugin2, "plugin2");
    OPEN2 = "<!--";
    CLOSE2 = "-->";
    __name(block3, "block3");
    __name(inline3, "inline3");
    __name(plugin3, "plugin3");
    Tokenizer = class {
      static {
        __name(this, "Tokenizer");
      }
      constructor(config2 = {}) {
        this.parser = new import_lib.default(config2);
        this.parser.use(plugin, "annotations", {});
        this.parser.use(plugin2, "frontmatter", {});
        this.parser.disable([
          "lheading",
          "code"
        ]);
        if (config2.allowComments)
          this.parser.use(plugin3, "comments", {});
      }
      tokenize(content) {
        return this.parser.parse(content.toString(), {});
      }
    };
    TypeMappings = {
      String,
      Number,
      Array,
      Object,
      Boolean
    };
    __name(validateType, "validateType");
    __name(typeToString, "typeToString");
    __name(validateFunction, "validateFunction");
    __name(displayMatches, "displayMatches");
    __name(validator, "validator");
    __name(walkWithParents, "walkWithParents");
    __name(validateTree, "validateTree");
    tokenizer = new Tokenizer();
    __name(mergeConfig, "mergeConfig");
    __name(parse3, "parse3");
    __name(resolve2, "resolve2");
    __name(transform2, "transform2");
    __name(validate2, "validate");
    __name(createElement, "createElement");
    Markdoc = class {
      static {
        __name(this, "Markdoc");
      }
      constructor(config2) {
        this.parse = parse3;
        this.resolve = (content) => resolve2(content, this.config);
        this.transform = (content) => transform2(content, this.config);
        this.validate = (content) => validate2(content, this.config);
        this.config = config2;
      }
    };
    Markdoc.nodes = schema_exports;
    Markdoc.tags = tags_default;
    Markdoc.functions = functions_default;
    Markdoc.globalAttributes = globalAttributes;
    Markdoc.renderers = renderers_default;
    Markdoc.transforms = transforms_default;
    Markdoc.Ast = ast_default;
    Markdoc.Tag = Tag;
    Markdoc.Tokenizer = Tokenizer;
    Markdoc.parseTags = parseTags;
    Markdoc.transformer = transformer_default;
    Markdoc.validator = validator;
    Markdoc.parse = parse3;
    Markdoc.transform = transform2;
    Markdoc.validate = validate2;
    Markdoc.createElement = createElement;
    Markdoc.truthy = truthy;
    Markdoc.format = format;
  }
});

// ../node_modules/emery/assertions/dist/emery-assertions.cjs.dev.js
var require_emery_assertions_cjs_dev = __commonJS({
  "../node_modules/emery/assertions/dist/emery-assertions.cjs.dev.js"(exports) {
    "use strict";
    init_functionsRoutes_0_8824942990098752();
    Object.defineProperty(exports, "__esModule", { value: true });
    function assert2(condition) {
      var message = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : "Assert failed";
      if (!condition) {
        throw new TypeError(message);
      }
    }
    __name(assert2, "assert");
    function assertNever2(arg) {
      throw new Error("Expected never to be called, but received: " + JSON.stringify(arg));
    }
    __name(assertNever2, "assertNever");
    function warning(condition, message) {
      if (true) {
        if (condition) {
          return;
        }
        var text3 = "Warning: ".concat(message);
        if (typeof console !== "undefined") {
          console.warn(text3);
        }
        try {
          throw Error(text3);
        } catch (x) {
        }
      }
    }
    __name(warning, "warning");
    exports.assert = assert2;
    exports.assertNever = assertNever2;
    exports.warning = warning;
  }
});

// ../node_modules/emery/assertions/dist/emery-assertions.cjs.js
var require_emery_assertions_cjs = __commonJS({
  "../node_modules/emery/assertions/dist/emery-assertions.cjs.js"(exports, module) {
    "use strict";
    init_functionsRoutes_0_8824942990098752();
    if (false) {
      module.exports = null;
    } else {
      module.exports = require_emery_assertions_cjs_dev();
    }
  }
});

// ../node_modules/emery/dist/number-1c017a79.cjs.dev.js
var require_number_1c017a79_cjs_dev = __commonJS({
  "../node_modules/emery/dist/number-1c017a79.cjs.dev.js"(exports) {
    "use strict";
    init_functionsRoutes_0_8824942990098752();
    function checkAll() {
      for (var _len = arguments.length, predicates = new Array(_len), _key = 0; _key < _len; _key++) {
        predicates[_key] = arguments[_key];
      }
      return function(value) {
        return predicates.every(function(p) {
          return p(value);
        });
      };
    }
    __name(checkAll, "checkAll");
    function checkAllWith(value) {
      for (var _len2 = arguments.length, predicates = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        predicates[_key2 - 1] = arguments[_key2];
      }
      return checkAll.apply(void 0, predicates)(value);
    }
    __name(checkAllWith, "checkAllWith");
    function negate(predicate) {
      return function(value) {
        return !predicate(value);
      };
    }
    __name(negate, "negate");
    var isFinite = Number.isFinite;
    var isInfinite = negate(isFinite);
    var isInteger = Number.isInteger;
    var isFloat = negate(isInteger);
    var isEven = /* @__PURE__ */ __name(function isEven2(value) {
      return value % 2 === 0;
    }, "isEven");
    var isOdd = /* @__PURE__ */ __name(function isOdd2(value) {
      return Math.abs(value % 2) === 1;
    }, "isOdd");
    var isNegativeZero = /* @__PURE__ */ __name(function isNegativeZero2(value) {
      return 1 / value === Number.NEGATIVE_INFINITY;
    }, "isNegativeZero");
    var isNegative = /* @__PURE__ */ __name(function isNegative2(value) {
      return value < 0;
    }, "isNegative");
    var isPositive = /* @__PURE__ */ __name(function isPositive2(value) {
      return value > 0;
    }, "isPositive");
    var isNonNegative = /* @__PURE__ */ __name(function isNonNegative2(value) {
      return value >= 0;
    }, "isNonNegative");
    var isNonPositive = /* @__PURE__ */ __name(function isNonPositive2(value) {
      return value <= 0;
    }, "isNonPositive");
    exports.checkAll = checkAll;
    exports.checkAllWith = checkAllWith;
    exports.isEven = isEven;
    exports.isFinite = isFinite;
    exports.isFloat = isFloat;
    exports.isInfinite = isInfinite;
    exports.isInteger = isInteger;
    exports.isNegative = isNegative;
    exports.isNegativeZero = isNegativeZero;
    exports.isNonNegative = isNonNegative;
    exports.isNonPositive = isNonPositive;
    exports.isOdd = isOdd;
    exports.isPositive = isPositive;
    exports.negate = negate;
  }
});

// ../node_modules/emery/guards/dist/emery-guards.cjs.dev.js
var require_emery_guards_cjs_dev = __commonJS({
  "../node_modules/emery/guards/dist/emery-guards.cjs.dev.js"(exports) {
    "use strict";
    init_functionsRoutes_0_8824942990098752();
    Object.defineProperty(exports, "__esModule", { value: true });
    function isBoolean(value) {
      return typeof value === "boolean";
    }
    __name(isBoolean, "isBoolean");
    function isNull(value) {
      return value === null;
    }
    __name(isNull, "isNull");
    function isNumber(value) {
      return typeof value === "number" && !isNaN(value);
    }
    __name(isNumber, "isNumber");
    function isString2(value) {
      return typeof value === "string";
    }
    __name(isString2, "isString");
    function isUndefined(value) {
      return value === void 0;
    }
    __name(isUndefined, "isUndefined");
    function isNonEmptyArray(value) {
      return value.length > 0;
    }
    __name(isNonEmptyArray, "isNonEmptyArray");
    function isNullish(value) {
      return value === null || value === void 0;
    }
    __name(isNullish, "isNullish");
    function isDefined(value) {
      return !isNullish(value);
    }
    __name(isDefined, "isDefined");
    function isFulfilled(result) {
      return result.status === "fulfilled";
    }
    __name(isFulfilled, "isFulfilled");
    function isRejected(result) {
      return result.status === "rejected";
    }
    __name(isRejected, "isRejected");
    exports.isBoolean = isBoolean;
    exports.isDefined = isDefined;
    exports.isFulfilled = isFulfilled;
    exports.isNonEmptyArray = isNonEmptyArray;
    exports.isNull = isNull;
    exports.isNullish = isNullish;
    exports.isNumber = isNumber;
    exports.isRejected = isRejected;
    exports.isString = isString2;
    exports.isUndefined = isUndefined;
  }
});

// ../node_modules/emery/opaques/dist/emery-opaques.cjs.dev.js
var require_emery_opaques_cjs_dev = __commonJS({
  "../node_modules/emery/opaques/dist/emery-opaques.cjs.dev.js"(exports) {
    "use strict";
    init_functionsRoutes_0_8824942990098752();
    Object.defineProperty(exports, "__esModule", { value: true });
    function castToOpaque(value) {
      return value;
    }
    __name(castToOpaque, "castToOpaque");
    exports.castToOpaque = castToOpaque;
  }
});

// ../node_modules/emery/dist/object-d7590283.cjs.dev.js
var require_object_d7590283_cjs_dev = __commonJS({
  "../node_modules/emery/dist/object-d7590283.cjs.dev.js"(exports) {
    "use strict";
    init_functionsRoutes_0_8824942990098752();
    function _typeof(obj) {
      "@babel/helpers - typeof";
      return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(obj2) {
        return typeof obj2;
      } : function(obj2) {
        return obj2 && "function" == typeof Symbol && obj2.constructor === Symbol && obj2 !== Symbol.prototype ? "symbol" : typeof obj2;
      }, _typeof(obj);
    }
    __name(_typeof, "_typeof");
    function getErrorMessage(error2) {
      var fallbackMessage = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : "Unknown error";
      if (isErrorLike(error2)) {
        return error2.message;
      }
      return error2 ? JSON.stringify(error2) : fallbackMessage;
    }
    __name(getErrorMessage, "getErrorMessage");
    function isErrorLike(error2) {
      return _typeof(error2) === "object" && error2 !== null && "message" in error2 && typeof error2.message === "string";
    }
    __name(isErrorLike, "isErrorLike");
    function typedEntries(value) {
      return Object.entries(value);
    }
    __name(typedEntries, "typedEntries");
    function typedKeys(value) {
      return Object.keys(value);
    }
    __name(typedKeys, "typedKeys");
    function typedObjectFromEntries(entries) {
      return Object.fromEntries(entries);
    }
    __name(typedObjectFromEntries, "typedObjectFromEntries");
    exports.getErrorMessage = getErrorMessage;
    exports.typedEntries = typedEntries;
    exports.typedKeys = typedKeys;
    exports.typedObjectFromEntries = typedObjectFromEntries;
  }
});

// ../node_modules/emery/dist/emery.cjs.dev.js
var require_emery_cjs_dev = __commonJS({
  "../node_modules/emery/dist/emery.cjs.dev.js"(exports) {
    "use strict";
    init_functionsRoutes_0_8824942990098752();
    Object.defineProperty(exports, "__esModule", { value: true });
    var assertions_dist_emeryAssertions = require_emery_assertions_cjs_dev();
    var number3 = require_number_1c017a79_cjs_dev();
    var guards_dist_emeryGuards = require_emery_guards_cjs_dev();
    var opaques_dist_emeryOpaques = require_emery_opaques_cjs_dev();
    var object2 = require_object_d7590283_cjs_dev();
    exports.assert = assertions_dist_emeryAssertions.assert;
    exports.assertNever = assertions_dist_emeryAssertions.assertNever;
    exports.warning = assertions_dist_emeryAssertions.warning;
    exports.checkAll = number3.checkAll;
    exports.checkAllWith = number3.checkAllWith;
    exports.isEven = number3.isEven;
    exports.isFinite = number3.isFinite;
    exports.isFloat = number3.isFloat;
    exports.isInfinite = number3.isInfinite;
    exports.isInteger = number3.isInteger;
    exports.isNegative = number3.isNegative;
    exports.isNegativeZero = number3.isNegativeZero;
    exports.isNonNegative = number3.isNonNegative;
    exports.isNonPositive = number3.isNonPositive;
    exports.isOdd = number3.isOdd;
    exports.isPositive = number3.isPositive;
    exports.negate = number3.negate;
    exports.isBoolean = guards_dist_emeryGuards.isBoolean;
    exports.isDefined = guards_dist_emeryGuards.isDefined;
    exports.isFulfilled = guards_dist_emeryGuards.isFulfilled;
    exports.isNonEmptyArray = guards_dist_emeryGuards.isNonEmptyArray;
    exports.isNull = guards_dist_emeryGuards.isNull;
    exports.isNullish = guards_dist_emeryGuards.isNullish;
    exports.isNumber = guards_dist_emeryGuards.isNumber;
    exports.isRejected = guards_dist_emeryGuards.isRejected;
    exports.isString = guards_dist_emeryGuards.isString;
    exports.isUndefined = guards_dist_emeryGuards.isUndefined;
    exports.castToOpaque = opaques_dist_emeryOpaques.castToOpaque;
    exports.getErrorMessage = object2.getErrorMessage;
    exports.typedEntries = object2.typedEntries;
    exports.typedKeys = object2.typedKeys;
    exports.typedObjectFromEntries = object2.typedObjectFromEntries;
  }
});

// ../node_modules/emery/dist/emery.cjs.js
var require_emery_cjs = __commonJS({
  "../node_modules/emery/dist/emery.cjs.js"(exports, module) {
    "use strict";
    init_functionsRoutes_0_8824942990098752();
    if (false) {
      module.exports = null;
    } else {
      module.exports = require_emery_cjs_dev();
    }
  }
});

// ../node_modules/@keystatic/core/dist/index-08620d62.worker.js
function assertRequired(value, validation, label) {
  if (value === null && validation !== null && validation !== void 0 && validation.isRequired) {
    throw new FieldDataError(`${label} is required`);
  }
}
function basicFormFieldWithSimpleReaderParse(config2) {
  return {
    kind: "form",
    Input: config2.Input,
    defaultValue: config2.defaultValue,
    parse: config2.parse,
    serialize: config2.serialize,
    validate: config2.validate,
    reader: {
      parse(value) {
        return config2.validate(config2.parse(value));
      }
    },
    label: config2.label
  };
}
function empty() {
  throw new Error("unexpected call to function that shouldn't be called in React server component environment");
}
function validateText(val, min, max2, fieldLabel, slugInfo, pattern) {
  if (val.length < min) {
    if (min === 1) {
      return `${fieldLabel} must not be empty`;
    } else {
      return `${fieldLabel} must be at least ${min} characters long`;
    }
  }
  if (val.length > max2) {
    return `${fieldLabel} must be no longer than ${max2} characters`;
  }
  if (pattern && !pattern.regex.test(val)) {
    return pattern.message || `${fieldLabel} must match the pattern ${pattern.regex}`;
  }
  if (slugInfo) {
    if (val === "") {
      return `${fieldLabel} must not be empty`;
    }
    if (val === "..") {
      return `${fieldLabel} must not be ..`;
    }
    if (val === ".") {
      return `${fieldLabel} must not be .`;
    }
    if (slugInfo.glob === "**") {
      const split = val.split("/");
      if (split.some((s2) => s2 === "..")) {
        return `${fieldLabel} must not contain ..`;
      }
      if (split.some((s2) => s2 === ".")) {
        return `${fieldLabel} must not be .`;
      }
    }
    if ((slugInfo.glob === "*" ? /[\\/]/ : /[\\]/).test(val)) {
      return `${fieldLabel} must not contain slashes`;
    }
    if (/^\s|\s$/.test(val)) {
      return `${fieldLabel} must not start or end with spaces`;
    }
    if (slugInfo.slugs.has(val)) {
      return `${fieldLabel} must be unique`;
    }
  }
}
function parseAsNormalField(value) {
  if (value === void 0) {
    return "";
  }
  if (typeof value !== "string") {
    throw new FieldDataError("Must be a string");
  }
  return value;
}
function text2({
  label,
  defaultValue = "",
  validation: {
    length: {
      max: max2 = Infinity,
      min = 0
    } = {},
    pattern,
    isRequired
  } = {},
  description,
  multiline = false
}) {
  min = Math.max(isRequired ? 1 : 0, min);
  function validate3(value, slugField) {
    const message = validateText(value, min, max2, label, slugField, pattern);
    if (message !== void 0) {
      throw new FieldDataError(message);
    }
    return value;
  }
  __name(validate3, "validate");
  return {
    kind: "form",
    formKind: "slug",
    label,
    Input(props) {
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextFieldInput, {
        label,
        description,
        min,
        max: max2,
        multiline,
        pattern,
        ...props
      });
    },
    defaultValue() {
      return typeof defaultValue === "string" ? defaultValue : defaultValue();
    },
    parse(value, args) {
      if ((args === null || args === void 0 ? void 0 : args.slug) !== void 0) {
        return args.slug;
      }
      return parseAsNormalField(value);
    },
    serialize(value) {
      return {
        value: value === "" ? void 0 : value
      };
    },
    serializeWithSlug(value) {
      return {
        slug: value,
        value: void 0
      };
    },
    reader: {
      parse(value) {
        const parsed = parseAsNormalField(value);
        return validate3(parsed, void 0);
      },
      parseWithSlug(_value, args) {
        validate3(parseAsNormalField(args.slug), {
          glob: args.glob,
          slugs: emptySet
        });
        return null;
      }
    },
    validate(value, args) {
      return validate3(value, args === null || args === void 0 ? void 0 : args.slugField);
    }
  };
}
var import_jsx_runtime, FieldDataError, SlugFieldInput, TextFieldInput, UrlFieldInput, SelectFieldInput, RelationshipInput, PathReferenceInput, MultiselectFieldInput, MultiRelationshipInput, IntegerFieldInput, NumberFieldInput, ImageFieldInput, FileFieldInput, DatetimeFieldInput, DateFieldInput, CloudImageFieldInput, BlocksFieldInput, DocumentFieldInput, CheckboxFieldInput, createEditorSchema, getDefaultValue, parseToEditorState, serializeFromEditorState, parseToEditorStateMDX, serializeFromEditorStateMDX, createEditorStateFromYJS, prosemirrorToYXmlFragment, normalizeDocumentFieldChildren, slugify, serializeMarkdoc, emptySet;
var init_index_08620d62_worker = __esm({
  "../node_modules/@keystatic/core/dist/index-08620d62.worker.js"() {
    init_functionsRoutes_0_8824942990098752();
    import_jsx_runtime = __toESM(require_jsx_runtime(), 1);
    FieldDataError = class extends Error {
      static {
        __name(this, "FieldDataError");
      }
      constructor(message) {
        super(message);
        this.name = "FieldDataError";
      }
    };
    __name(assertRequired, "assertRequired");
    __name(basicFormFieldWithSimpleReaderParse, "basicFormFieldWithSimpleReaderParse");
    __name(empty, "empty");
    SlugFieldInput = empty;
    TextFieldInput = empty;
    UrlFieldInput = empty;
    SelectFieldInput = empty;
    RelationshipInput = empty;
    PathReferenceInput = empty;
    MultiselectFieldInput = empty;
    MultiRelationshipInput = empty;
    IntegerFieldInput = empty;
    NumberFieldInput = empty;
    ImageFieldInput = empty;
    FileFieldInput = empty;
    DatetimeFieldInput = empty;
    DateFieldInput = empty;
    CloudImageFieldInput = empty;
    BlocksFieldInput = empty;
    DocumentFieldInput = empty;
    CheckboxFieldInput = empty;
    createEditorSchema = empty;
    getDefaultValue = empty;
    parseToEditorState = empty;
    serializeFromEditorState = empty;
    parseToEditorStateMDX = empty;
    serializeFromEditorStateMDX = empty;
    createEditorStateFromYJS = empty;
    prosemirrorToYXmlFragment = empty;
    normalizeDocumentFieldChildren = empty;
    slugify = empty;
    serializeMarkdoc = empty;
    __name(validateText, "validateText");
    __name(parseAsNormalField, "parseAsNormalField");
    emptySet = /* @__PURE__ */ new Set();
    __name(text2, "text");
  }
});

// ../node_modules/@keystatic/core/dist/index-382895ba.worker.js
function object(fields, opts) {
  return {
    ...opts,
    kind: "object",
    fields
  };
}
function getValueAtPropPath(value, inputPath) {
  const path = [...inputPath];
  while (path.length) {
    const key = path.shift();
    value = value[key];
  }
  return value;
}
function transformProps(schema, value, visitors, path = []) {
  if (schema.kind === "form" || schema.kind === "child") {
    if (visitors[schema.kind]) {
      return visitors[schema.kind](schema, value, path);
    }
    return value;
  }
  if (schema.kind === "object") {
    const val = Object.fromEntries(Object.entries(schema.fields).map(([key, val2]) => {
      return [key, transformProps(val2, value[key], visitors, [...path, key])];
    }));
    if (visitors.object) {
      return visitors[schema.kind](schema, val, path);
    }
    return val;
  }
  if (schema.kind === "array") {
    const val = value.map((val2, idx) => transformProps(schema.element, val2, visitors, path.concat(idx)));
    if (visitors.array) {
      return visitors[schema.kind](schema, val, path);
    }
    return val;
  }
  if (schema.kind === "conditional") {
    const discriminant = transformProps(schema.discriminant, value.discriminant, visitors, path.concat("discriminant"));
    const conditionalVal = transformProps(schema.values[discriminant.toString()], value.value, visitors, path.concat("value"));
    const val = {
      discriminant,
      value: conditionalVal
    };
    if (visitors.conditional) {
      return visitors[schema.kind](schema, val, path);
    }
    return val;
  }
  (0, import_assertions.assertNever)(schema);
}
function addMarkToChildren(mark, cb) {
  const wasPreviouslyActive = currentlyActiveMarks.has(mark);
  currentlyActiveMarks.add(mark);
  try {
    return cb();
  } finally {
    if (!wasPreviouslyActive) {
      currentlyActiveMarks.delete(mark);
    }
  }
}
function setLinkForChildren(href, cb) {
  if (currentLink !== null) {
    return cb();
  }
  currentLink = href;
  try {
    return cb();
  } finally {
    currentLink = null;
  }
}
function getInlineNodes(text3) {
  const node2 = {
    text: text3
  };
  for (const mark of currentlyActiveMarks) {
    if (!currentlyDisabledMarks.has(mark)) {
      node2[mark] = true;
    }
  }
  if (currentLink !== null) {
    return [{
      text: ""
    }, {
      type: "link",
      href: currentLink,
      children: [node2]
    }, {
      text: ""
    }];
  }
  return [node2];
}
function findSingleChildField(schema) {
  try {
    const result = _findConstantChildFields(schema, [], /* @__PURE__ */ new Set());
    if (result.length === 1) {
      return result[0];
    }
    return;
  } catch (err) {
    if (err instanceof VariableChildFields) {
      return;
    }
    throw err;
  }
}
function _findConstantChildFields(schema, path, seenSchemas) {
  if (seenSchemas.has(schema)) {
    return [];
  }
  seenSchemas.add(schema);
  switch (schema.kind) {
    case "form":
      return [];
    case "child":
      return [{
        relativePath: path,
        options: schema.options,
        kind: "child"
      }];
    case "conditional": {
      if (couldContainChildField(schema)) {
        throw new VariableChildFields();
      }
      return [];
    }
    case "array": {
      if (schema.asChildTag) {
        const child2 = _findConstantChildFields(schema.element, [], seenSchemas);
        if (child2.length > 1) {
          return [];
        }
        return [{
          kind: "array",
          asChildTag: schema.asChildTag,
          field: schema,
          relativePath: path,
          child: child2[0]
        }];
      }
      if (couldContainChildField(schema)) {
        throw new VariableChildFields();
      }
      return [];
    }
    case "object": {
      const paths = [];
      for (const [key, value] of Object.entries(schema.fields)) {
        paths.push(..._findConstantChildFields(value, path.concat(key), seenSchemas));
      }
      return paths;
    }
  }
}
function couldContainChildField(schema, seen = /* @__PURE__ */ new Set()) {
  if (seen.has(schema)) {
    return false;
  }
  seen.add(schema);
  switch (schema.kind) {
    case "form":
      return false;
    case "child":
      return true;
    case "conditional":
      return Object.values(schema.values).some((value) => couldContainChildField(value, seen));
    case "object":
      return Object.keys(schema.fields).some((key) => couldContainChildField(schema.fields[key], seen));
    case "array":
      return couldContainChildField(schema.element, seen);
  }
}
function inlineNodeFromMarkdoc(node2) {
  if (node2.type === "inline") {
    return inlineChildrenFromMarkdoc(node2.children);
  }
  if (node2.type === "link") {
    return setLinkForChildren(node2.attributes.href, () => inlineChildrenFromMarkdoc(node2.children));
  }
  if (node2.type === "text") {
    return getInlineNodes(node2.attributes.content);
  }
  if (node2.type === "strong") {
    return addMarkToChildren("bold", () => inlineChildrenFromMarkdoc(node2.children));
  }
  if (node2.type === "code") {
    return addMarkToChildren("code", () => getInlineNodes(node2.attributes.content));
  }
  if (node2.type === "em") {
    return addMarkToChildren("italic", () => inlineChildrenFromMarkdoc(node2.children));
  }
  if (node2.type === "s") {
    return addMarkToChildren("strikethrough", () => inlineChildrenFromMarkdoc(node2.children));
  }
  if (node2.type === "tag") {
    if (node2.tag === "u") {
      return addMarkToChildren("underline", () => inlineChildrenFromMarkdoc(node2.children));
    }
    if (node2.tag === "kbd") {
      return addMarkToChildren("keyboard", () => inlineChildrenFromMarkdoc(node2.children));
    }
    if (node2.tag === "sub") {
      return addMarkToChildren("subscript", () => inlineChildrenFromMarkdoc(node2.children));
    }
    if (node2.tag === "sup") {
      return addMarkToChildren("superscript", () => inlineChildrenFromMarkdoc(node2.children));
    }
  }
  if (node2.type === "softbreak") {
    return getInlineNodes(" ");
  }
  if (node2.type === "hardbreak") {
    return getInlineNodes("\n");
  }
  if (node2.tag === "component-inline-prop" && Array.isArray(node2.attributes.propPath) && node2.attributes.propPath.every((x) => typeof x === "string" || typeof x === "number")) {
    return {
      type: "component-inline-prop",
      children: inlineFromMarkdoc(node2.children),
      propPath: node2.attributes.propPath
    };
  }
  throw new Error(`Unknown inline node type: ${node2.type}`);
}
function inlineChildrenFromMarkdoc(nodes) {
  return nodes.flatMap(inlineNodeFromMarkdoc);
}
function inlineFromMarkdoc(nodes) {
  const transformedNodes = nodes.flatMap(inlineNodeFromMarkdoc);
  const nextNodes = [];
  let lastNode;
  for (const [idx, node2] of transformedNodes.entries()) {
    var _lastNode;
    if (node2.type === void 0 && node2.text === "" && ((_lastNode = lastNode) === null || _lastNode === void 0 ? void 0 : _lastNode.type) === void 0 && idx !== transformedNodes.length - 1) {
      continue;
    }
    nextNodes.push(node2);
    lastNode = node2;
  }
  if (!nextNodes.length) {
    nextNodes.push({
      text: ""
    });
  }
  return nextNodes;
}
function fromMarkdoc(node2, componentBlocks) {
  const nodes = node2.children.flatMap((x) => fromMarkdocNode(x, componentBlocks));
  if (nodes.length === 0) {
    return [{
      type: "paragraph",
      children: [{
        text: ""
      }]
    }];
  }
  if (nodes[nodes.length - 1].type !== "paragraph") {
    nodes.push({
      type: "paragraph",
      children: [{
        text: ""
      }]
    });
  }
  return nodes;
}
function fromMarkdocNode(node2, componentBlocks) {
  if (node2.type === "blockquote") {
    return {
      type: "blockquote",
      children: node2.children.flatMap((x) => fromMarkdocNode(x, componentBlocks))
    };
  }
  if (node2.type === "fence") {
    const {
      language,
      content,
      ...rest
    } = node2.attributes;
    return {
      type: "code",
      children: [{
        text: content.replace(/\n$/, "")
      }],
      ...typeof language === "string" ? {
        language
      } : {},
      ...rest
    };
  }
  if (node2.type === "heading") {
    return {
      ...node2.attributes,
      level: node2.attributes.level,
      type: "heading",
      children: inlineFromMarkdoc(node2.children)
    };
  }
  if (node2.type === "list") {
    return {
      type: node2.attributes.ordered ? "ordered-list" : "unordered-list",
      children: node2.children.flatMap((x) => fromMarkdocNode(x, componentBlocks))
    };
  }
  if (node2.type === "item") {
    var _node$children$;
    const children = [{
      type: "list-item-content",
      children: node2.children.length ? inlineFromMarkdoc([node2.children[0]]) : [{
        text: ""
      }]
    }];
    if (((_node$children$ = node2.children[1]) === null || _node$children$ === void 0 ? void 0 : _node$children$.type) === "list") {
      const list2 = node2.children[1];
      children.push({
        type: list2.attributes.ordered ? "ordered-list" : "unordered-list",
        children: list2.children.flatMap((x) => fromMarkdocNode(x, componentBlocks))
      });
    }
    return {
      type: "list-item",
      children
    };
  }
  if (node2.type === "paragraph") {
    if (node2.children.length === 1 && node2.children[0].type === "inline" && node2.children[0].children.length === 1 && node2.children[0].children[0].type === "image") {
      var _image$attributes$tit;
      const image3 = node2.children[0].children[0];
      return {
        type: "image",
        src: decodeURI(image3.attributes.src),
        alt: image3.attributes.alt,
        title: (_image$attributes$tit = image3.attributes.title) !== null && _image$attributes$tit !== void 0 ? _image$attributes$tit : "",
        children: [{
          text: ""
        }]
      };
    }
    const children = inlineFromMarkdoc(node2.children);
    if (children.length === 1 && children[0].type === "component-inline-prop") {
      return children[0];
    }
    return {
      type: "paragraph",
      children,
      textAlign: node2.attributes.textAlign
    };
  }
  if (node2.type === "hr") {
    return {
      type: "divider",
      children: [{
        text: ""
      }]
    };
  }
  if (node2.type === "table") {
    return {
      type: "table",
      children: node2.children.flatMap((x) => fromMarkdocNode(x, componentBlocks))
    };
  }
  if (node2.type === "tbody") {
    return {
      type: "table-body",
      children: node2.children.flatMap((x) => fromMarkdocNode(x, componentBlocks))
    };
  }
  if (node2.type === "thead") {
    if (!node2.children.length) return [];
    return {
      type: "table-head",
      children: node2.children.flatMap((x) => fromMarkdocNode(x, componentBlocks))
    };
  }
  if (node2.type === "tr") {
    return {
      type: "table-row",
      children: node2.children.flatMap((x) => fromMarkdocNode(x, componentBlocks))
    };
  }
  if (node2.type === "td") {
    return {
      type: "table-cell",
      children: node2.children.flatMap((x) => fromMarkdocNode(x, componentBlocks))
    };
  }
  if (node2.type === "th") {
    return {
      type: "table-cell",
      header: true,
      children: node2.children.flatMap((x) => fromMarkdocNode(x, componentBlocks))
    };
  }
  if (node2.type === "tag") {
    if (node2.tag === "table") {
      return fromMarkdocNode(node2.children[0], componentBlocks);
    }
    if (node2.tag === "layout") {
      return {
        type: "layout",
        layout: node2.attributes.layout,
        children: node2.children.flatMap((x) => fromMarkdocNode(x, componentBlocks))
      };
    }
    if (node2.tag === "layout-area") {
      return {
        type: "layout-area",
        children: node2.children.flatMap((x) => fromMarkdocNode(x, componentBlocks))
      };
    }
    if (node2.tag === "component-block") {
      return {
        type: "component-block",
        component: node2.attributes.component,
        props: node2.attributes.props,
        children: node2.children.length === 0 ? [{
          type: "component-inline-prop",
          children: [{
            text: ""
          }]
        }] : node2.children.flatMap((x) => fromMarkdocNode(x, componentBlocks))
      };
    }
    if (node2.tag === "component-block-prop" && Array.isArray(node2.attributes.propPath) && node2.attributes.propPath.every((x) => typeof x === "string" || typeof x === "number")) {
      return {
        type: "component-block-prop",
        children: node2.children.flatMap((x) => fromMarkdocNode(x, componentBlocks)),
        propPath: node2.attributes.propPath
      };
    }
    if (node2.tag) {
      const componentBlock = componentBlocks[node2.tag];
      if (componentBlock) {
        const singleChildField = findSingleChildField({
          kind: "object",
          fields: componentBlock.schema
        });
        if (singleChildField) {
          const newAttributes = JSON.parse(JSON.stringify(node2.attributes));
          const children = [];
          toChildrenAndProps(node2.children, children, newAttributes, singleChildField, [], componentBlocks);
          return {
            type: "component-block",
            component: node2.tag,
            props: newAttributes,
            children
          };
        }
        return {
          type: "component-block",
          component: node2.tag,
          props: node2.attributes,
          children: node2.children.length === 0 ? [{
            type: "component-inline-prop",
            children: [{
              text: ""
            }]
          }] : node2.children.flatMap((x) => fromMarkdocNode(x, componentBlocks))
        };
      }
    }
    throw new Error(`Unknown tag: ${node2.tag}`);
  }
  return inlineNodeFromMarkdoc(node2);
}
function toChildrenAndProps(fromMarkdoc2, resultingChildren, value, singleChildField, parentPropPath, componentBlocks) {
  if (singleChildField.kind === "child") {
    const children = fromMarkdoc2.flatMap((x) => fromMarkdocNode(x, componentBlocks));
    resultingChildren.push({
      type: `component-${singleChildField.options.kind}-prop`,
      propPath: [...parentPropPath, ...singleChildField.relativePath],
      children
    });
  }
  if (singleChildField.kind === "array") {
    const arr = [];
    for (let [idx, child2] of fromMarkdoc2.entries()) {
      if (child2.type === "paragraph") {
        child2 = child2.children[0].children[0];
      }
      if (child2.type !== "tag") {
        throw new Error(`expected tag ${singleChildField.asChildTag}, found type: ${child2.type}`);
      }
      if (child2.tag !== singleChildField.asChildTag) {
        throw new Error(`expected tag ${singleChildField.asChildTag}, found tag: ${child2.tag}`);
      }
      const attributes = JSON.parse(JSON.stringify(child2.attributes));
      if (singleChildField.child) {
        toChildrenAndProps(child2.children, resultingChildren, attributes, singleChildField.child, [...parentPropPath, ...singleChildField.relativePath, idx], componentBlocks);
      }
      arr.push(attributes);
    }
    const key = singleChildField.relativePath[singleChildField.relativePath.length - 1];
    const parent = getValueAtPropPath(value, singleChildField.relativePath.slice(0, -1));
    parent[key] = arr;
  }
}
function memoize(func) {
  const cacheNode = {
    value: emptyCacheNode,
    strong: void 0,
    weak: void 0
  };
  return (...args) => {
    let currentCacheNode = cacheNode;
    for (const arg of args) {
      if (typeof arg === "string" || typeof arg === "number") {
        if (currentCacheNode.strong === void 0) {
          currentCacheNode.strong = /* @__PURE__ */ new Map();
        }
        if (!currentCacheNode.strong.has(arg)) {
          currentCacheNode.strong.set(arg, {
            value: emptyCacheNode,
            strong: void 0,
            weak: void 0
          });
        }
        currentCacheNode = currentCacheNode.strong.get(arg);
        continue;
      }
      if (typeof arg === "object") {
        if (currentCacheNode.weak === void 0) {
          currentCacheNode.weak = /* @__PURE__ */ new WeakMap();
        }
        if (!currentCacheNode.weak.has(arg)) {
          currentCacheNode.weak.set(arg, {
            value: emptyCacheNode,
            strong: void 0,
            weak: void 0
          });
        }
        currentCacheNode = currentCacheNode.weak.get(arg);
        continue;
      }
    }
    if (currentCacheNode.value !== emptyCacheNode) {
      return currentCacheNode.value;
    }
    const result = func(...args);
    currentCacheNode.value = result;
    return result;
  };
}
function fixPath(path) {
  return path.replace(/^\.?\/+/, "").replace(/\/*$/, "");
}
function getConfiguredCollectionPath(config2, collection2) {
  var _collectionConfig$pat;
  const collectionConfig = config2.collections[collection2];
  const path = (_collectionConfig$pat = collectionConfig.path) !== null && _collectionConfig$pat !== void 0 ? _collectionConfig$pat : `${collection2}/*/`;
  if (!collectionPath.test(path)) {
    throw new Error(`Collection path must end with /* or /** or include /*/ or /**/ but ${collection2} has ${path}`);
  }
  return path;
}
function _getFormatInfo(config2, type2, key) {
  var _collectionOrSingleto, _format$data;
  const collectionOrSingleton = type2 === "collections" ? config2.collections[key] : config2.singletons[key];
  const path = type2 === "collections" ? getConfiguredCollectionPath(config2, key) : (_collectionOrSingleto = collectionOrSingleton.path) !== null && _collectionOrSingleto !== void 0 ? _collectionOrSingleto : `${key}/`;
  const dataLocation = path.endsWith("/") ? "index" : "outer";
  const {
    schema,
    format: format2 = "yaml"
  } = collectionOrSingleton;
  if (typeof format2 === "string") {
    return {
      dataLocation,
      contentField: void 0,
      data: format2
    };
  }
  let contentField;
  if (format2.contentField) {
    let field = {
      kind: "object",
      fields: schema
    };
    let path2 = Array.isArray(format2.contentField) ? format2.contentField : [format2.contentField];
    let contentExtension;
    try {
      contentExtension = getContentExtension(path2, field, () => JSON.stringify(format2.contentField));
    } catch (err) {
      if (err instanceof ContentFieldLocationError) {
        throw new Error(`${err.message} (${type2}.${key})`);
      }
      throw err;
    }
    contentField = {
      path: path2,
      contentExtension
    };
  }
  return {
    data: (_format$data = format2.data) !== null && _format$data !== void 0 ? _format$data : "yaml",
    contentField,
    dataLocation
  };
}
function getContentExtension(path, schema, debugName) {
  if (path.length === 0) {
    if (schema.kind !== "form" || schema.formKind !== "content") {
      throw new ContentFieldLocationError(`Content field for ${debugName()} is not a content field`);
    }
    return schema.contentExtension;
  }
  if (schema.kind === "object") {
    const field = schema.fields[path[0]];
    if (!field) {
      throw new ContentFieldLocationError(`Field ${debugName()} specified in contentField does not exist`);
    }
    return getContentExtension(path.slice(1), field, debugName);
  }
  if (schema.kind === "conditional") {
    if (path[0] !== "value") {
      throw new ContentFieldLocationError(`Conditional fields referenced in a contentField path must only reference the value field (${debugName()})`);
    }
    let contentExtension;
    const innerPath = path.slice(1);
    for (const value of Object.values(schema.values)) {
      const foundContentExtension = getContentExtension(innerPath, value, debugName);
      if (!contentExtension) {
        contentExtension = foundContentExtension;
        continue;
      }
      if (contentExtension !== foundContentExtension) {
        throw new ContentFieldLocationError(`contentField ${debugName()} has conflicting content extensions`);
      }
    }
    if (!contentExtension) {
      throw new ContentFieldLocationError(`contentField ${debugName()} does not point to a content field`);
    }
    return contentExtension;
  }
  throw new ContentFieldLocationError(`Path specified in contentField ${debugName()} does not point to a content field`);
}
function getSrcPrefix(publicPath, slug2) {
  return typeof publicPath === "string" ? `${publicPath.replace(/\/*$/, "")}/${slug2 === void 0 ? "" : slug2 + "/"}` : "";
}
function deserializeFiles(nodes, componentBlocks, files, otherFiles, mode, documentFeatures, slug2) {
  return nodes.map((node2) => {
    if (node2.type === "component-block") {
      const componentBlock = componentBlocks[node2.component];
      if (!componentBlock) return node2;
      const schema = object(componentBlock.schema);
      return {
        ...node2,
        props: deserializeProps(schema, node2.props, files, otherFiles, mode, slug2)
      };
    }
    if (node2.type === "image" && typeof node2.src === "string" && mode === "edit") {
      var _ref;
      const prefix = getSrcPrefixForImageBlock(documentFeatures, slug2);
      const filename = node2.src.slice(prefix.length);
      const content = (_ref = typeof documentFeatures.images === "object" && typeof documentFeatures.images.directory === "string" ? otherFiles.get(fixPath(documentFeatures.images.directory)) : files) === null || _ref === void 0 ? void 0 : _ref.get(filename);
      if (!content) {
        return {
          type: "paragraph",
          children: [{
            text: `Missing image ${filename}`
          }]
        };
      }
      return {
        type: "image",
        src: {
          filename,
          content
        },
        alt: node2.alt,
        title: node2.title,
        children: [{
          text: ""
        }]
      };
    }
    if (typeof node2.type === "string") {
      const children = deserializeFiles(node2.children, componentBlocks, files, otherFiles, mode, documentFeatures, slug2);
      return {
        ...node2,
        children
      };
    }
    return node2;
  });
}
function deserializeProps(schema, value, files, otherFiles, mode, slug2) {
  return transformProps(schema, value, {
    form: /* @__PURE__ */ __name((schema2, value2) => {
      if (schema2.formKind === "asset") {
        var _otherFiles$get;
        if (mode === "read") {
          return schema2.reader.parse(value2);
        }
        const filename = schema2.filename(value2, {
          slug: slug2,
          suggestedFilenamePrefix: void 0
        });
        return schema2.parse(value2, {
          asset: filename ? schema2.directory ? (_otherFiles$get = otherFiles.get(schema2.directory)) === null || _otherFiles$get === void 0 ? void 0 : _otherFiles$get.get(filename) : files.get(filename) : void 0,
          slug: slug2
        });
      }
      if (schema2.formKind === "content" || schema2.formKind === "assets") {
        throw new Error("Not implemented");
      }
      if (mode === "read") {
        return schema2.reader.parse(value2);
      }
      return schema2.parse(value2, void 0);
    }, "form")
  });
}
function getSrcPrefixForImageBlock(documentFeatures, slug2) {
  return getSrcPrefix(typeof documentFeatures.images === "object" ? documentFeatures.images.publicPath : void 0, slug2);
}
function collectDirectoriesUsedInSchemaInner(schema, directories, seenSchemas) {
  if (seenSchemas.has(schema)) {
    return;
  }
  seenSchemas.add(schema);
  if (schema.kind === "array") {
    return collectDirectoriesUsedInSchemaInner(schema.element, directories, seenSchemas);
  }
  if (schema.kind === "child") {
    return;
  }
  if (schema.kind === "form") {
    if (schema.formKind === "asset" && schema.directory !== void 0) {
      directories.add(fixPath(schema.directory));
    }
    if ((schema.formKind === "content" || schema.formKind === "assets") && schema.directories !== void 0) {
      for (const directory of schema.directories) {
        directories.add(fixPath(directory));
      }
    }
    return;
  }
  if (schema.kind === "object") {
    for (const field of Object.values(schema.fields)) {
      collectDirectoriesUsedInSchemaInner(field, directories, seenSchemas);
    }
    return;
  }
  if (schema.kind === "conditional") {
    for (const innerSchema of Object.values(schema.values)) {
      collectDirectoriesUsedInSchemaInner(innerSchema, directories, seenSchemas);
    }
    return;
  }
  (0, import_emery.assertNever)(schema);
}
function collectDirectoriesUsedInSchema(schema) {
  const directories = /* @__PURE__ */ new Set();
  collectDirectoriesUsedInSchemaInner(schema, directories, /* @__PURE__ */ new Set());
  return directories;
}
function normaliseDocumentFeatures(config2) {
  var _config$formatting, _formatting$alignment, _formatting$alignment2, _formatting$blockType, _formatting$inlineMar, _formatting$inlineMar2, _formatting$inlineMar3, _formatting$inlineMar4, _formatting$inlineMar5, _formatting$inlineMar6, _formatting$inlineMar7, _formatting$inlineMar8, _formatting$listTypes, _formatting$listTypes2, _imagesConfig$schema$, _imagesConfig$schema, _imagesConfig$schema$2, _imagesConfig$schema2;
  const formatting = config2.formatting === true ? {
    // alignment: true, // not supported natively in markdown
    blockTypes: true,
    headingLevels: true,
    inlineMarks: true,
    listTypes: true,
    softBreaks: true
  } : (_config$formatting = config2.formatting) !== null && _config$formatting !== void 0 ? _config$formatting : {};
  const imagesConfig = config2.images === true ? {} : config2.images;
  return {
    formatting: {
      alignment: formatting.alignment === true ? {
        center: true,
        end: true
      } : {
        center: !!((_formatting$alignment = formatting.alignment) !== null && _formatting$alignment !== void 0 && _formatting$alignment.center),
        end: !!((_formatting$alignment2 = formatting.alignment) !== null && _formatting$alignment2 !== void 0 && _formatting$alignment2.end)
      },
      blockTypes: (formatting === null || formatting === void 0 ? void 0 : formatting.blockTypes) === true ? {
        blockquote: true,
        code: {
          schema: object({})
        }
      } : {
        blockquote: !!((_formatting$blockType = formatting.blockTypes) !== null && _formatting$blockType !== void 0 && _formatting$blockType.blockquote),
        code: ((_formatting$blockType2) => {
          if (((_formatting$blockType2 = formatting.blockTypes) === null || _formatting$blockType2 === void 0 ? void 0 : _formatting$blockType2.code) === void 0) {
            return false;
          }
          if (formatting.blockTypes.code === true || !formatting.blockTypes.code.schema) {
            return {
              schema: object({})
            };
          }
          for (const key of ["type", "children", "language"]) {
            if (key in formatting.blockTypes.code.schema) {
              throw new Error(`"${key}" cannot be a key in the schema for code blocks`);
            }
          }
          return {
            schema: object(formatting.blockTypes.code.schema)
          };
        })()
      },
      headings: ((_obj$schema) => {
        const opt = formatting === null || formatting === void 0 ? void 0 : formatting.headingLevels;
        const obj = typeof opt === "object" && "levels" in opt ? opt : {
          levels: opt,
          schema: void 0
        };
        if (obj.schema) {
          for (const key of ["type", "children", "level", "textAlign"]) {
            if (key in obj.schema) {
              throw new Error(`"${key}" cannot be a key in the schema for headings`);
            }
          }
        }
        return {
          levels: [...new Set(obj.levels === true ? [1, 2, 3, 4, 5, 6] : obj.levels)],
          schema: object((_obj$schema = obj.schema) !== null && _obj$schema !== void 0 ? _obj$schema : {})
        };
      })(),
      inlineMarks: formatting.inlineMarks === true ? {
        bold: true,
        code: true,
        italic: true,
        keyboard: false,
        // not supported natively in markdown
        strikethrough: true,
        subscript: false,
        // not supported natively in markdown
        superscript: false,
        // not supported natively in markdown
        underline: false
        // not supported natively in markdown
      } : {
        bold: !!((_formatting$inlineMar = formatting.inlineMarks) !== null && _formatting$inlineMar !== void 0 && _formatting$inlineMar.bold),
        code: !!((_formatting$inlineMar2 = formatting.inlineMarks) !== null && _formatting$inlineMar2 !== void 0 && _formatting$inlineMar2.code),
        italic: !!((_formatting$inlineMar3 = formatting.inlineMarks) !== null && _formatting$inlineMar3 !== void 0 && _formatting$inlineMar3.italic),
        strikethrough: !!((_formatting$inlineMar4 = formatting.inlineMarks) !== null && _formatting$inlineMar4 !== void 0 && _formatting$inlineMar4.strikethrough),
        underline: !!((_formatting$inlineMar5 = formatting.inlineMarks) !== null && _formatting$inlineMar5 !== void 0 && _formatting$inlineMar5.underline),
        keyboard: !!((_formatting$inlineMar6 = formatting.inlineMarks) !== null && _formatting$inlineMar6 !== void 0 && _formatting$inlineMar6.keyboard),
        subscript: !!((_formatting$inlineMar7 = formatting.inlineMarks) !== null && _formatting$inlineMar7 !== void 0 && _formatting$inlineMar7.subscript),
        superscript: !!((_formatting$inlineMar8 = formatting.inlineMarks) !== null && _formatting$inlineMar8 !== void 0 && _formatting$inlineMar8.superscript)
      },
      listTypes: formatting.listTypes === true ? {
        ordered: true,
        unordered: true
      } : {
        ordered: !!((_formatting$listTypes = formatting.listTypes) !== null && _formatting$listTypes !== void 0 && _formatting$listTypes.ordered),
        unordered: !!((_formatting$listTypes2 = formatting.listTypes) !== null && _formatting$listTypes2 !== void 0 && _formatting$listTypes2.unordered)
      },
      softBreaks: !!formatting.softBreaks
    },
    links: !!config2.links,
    layouts: [...new Set((config2.layouts || []).map((x) => JSON.stringify(x)))].map((x) => JSON.parse(x)),
    dividers: !!config2.dividers,
    images: imagesConfig === void 0 ? false : {
      ...imagesConfig,
      schema: {
        alt: (_imagesConfig$schema$ = (_imagesConfig$schema = imagesConfig.schema) === null || _imagesConfig$schema === void 0 ? void 0 : _imagesConfig$schema.alt) !== null && _imagesConfig$schema$ !== void 0 ? _imagesConfig$schema$ : defaultAltField$1,
        title: (_imagesConfig$schema$2 = (_imagesConfig$schema2 = imagesConfig.schema) === null || _imagesConfig$schema2 === void 0 ? void 0 : _imagesConfig$schema2.title) !== null && _imagesConfig$schema$2 !== void 0 ? _imagesConfig$schema$2 : emptyTitleField$1
      }
    },
    tables: !!config2.tables
  };
}
function document2({
  label,
  componentBlocks = {},
  description,
  ...documentFeaturesConfig
}) {
  const documentFeatures = normaliseDocumentFeatures(documentFeaturesConfig);
  return {
    kind: "form",
    formKind: "content",
    defaultValue() {
      return [{
        type: "paragraph",
        children: [{
          text: ""
        }]
      }];
    },
    Input(props) {
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(DocumentFieldInput, {
        componentBlocks,
        description,
        label,
        documentFeatures,
        ...props
      });
    },
    parse(_, data) {
      const markdoc2 = textDecoder$1.decode(data.content);
      fromMarkdoc(parse3(markdoc2), componentBlocks);
      return deserializeFiles(normalizeDocumentFieldChildren(), componentBlocks, data.other, data.external, "edit", documentFeatures, data.slug);
    },
    contentExtension: ".mdoc",
    validate(value) {
      return value;
    },
    directories: [...collectDirectoriesUsedInSchema(object(Object.fromEntries(Object.entries(componentBlocks).map(([name, block4]) => [name, object(block4.schema)])))), ...typeof documentFeatures.images === "object" && typeof documentFeatures.images.directory === "string" ? [fixPath(documentFeatures.images.directory)] : []],
    serialize(value, opts) {
      return serializeMarkdoc();
    },
    reader: {
      parse(value, data) {
        const markdoc2 = textDecoder$1.decode(data.content);
        const document3 = fromMarkdoc(parse3(markdoc2), componentBlocks);
        return deserializeFiles(document3, componentBlocks, /* @__PURE__ */ new Map(), /* @__PURE__ */ new Map(), "read", documentFeatures, void 0);
      }
    }
  };
}
function editorOptionsToConfig(options) {
  var _options$bold, _options$italic, _options$strikethroug, _options$code, _options$blockquote, _options$orderedList, _options$unorderedLis, _options$table, _options$link, _options$divider;
  return {
    bold: (_options$bold = options.bold) !== null && _options$bold !== void 0 ? _options$bold : true,
    italic: (_options$italic = options.italic) !== null && _options$italic !== void 0 ? _options$italic : true,
    strikethrough: (_options$strikethroug = options.strikethrough) !== null && _options$strikethroug !== void 0 ? _options$strikethroug : true,
    code: (_options$code = options.code) !== null && _options$code !== void 0 ? _options$code : true,
    heading: (() => {
      let levels = [];
      let levelsOpt = typeof options.heading === "object" && !Array.isArray(options.heading) ? options.heading.levels : options.heading;
      if (levelsOpt === true || levelsOpt === void 0) {
        levels = [1, 2, 3, 4, 5, 6];
      }
      if (Array.isArray(levelsOpt)) {
        levels = levelsOpt;
      }
      return {
        levels,
        schema: options.heading && typeof options.heading === "object" && "schema" in options.heading ? options.heading.schema : {}
      };
    })(),
    blockquote: (_options$blockquote = options.blockquote) !== null && _options$blockquote !== void 0 ? _options$blockquote : true,
    orderedList: (_options$orderedList = options.orderedList) !== null && _options$orderedList !== void 0 ? _options$orderedList : true,
    unorderedList: (_options$unorderedLis = options.unorderedList) !== null && _options$unorderedLis !== void 0 ? _options$unorderedLis : true,
    table: (_options$table = options.table) !== null && _options$table !== void 0 ? _options$table : true,
    link: (_options$link = options.link) !== null && _options$link !== void 0 ? _options$link : true,
    image: options.image !== false ? ((_opts$transformFilena, _opts$schema$alt, _opts$schema, _opts$schema$title, _opts$schema2) => {
      const opts = options.image === true ? void 0 : options.image;
      return {
        directory: opts === null || opts === void 0 ? void 0 : opts.directory,
        publicPath: opts === null || opts === void 0 ? void 0 : opts.publicPath,
        transformFilename: (_opts$transformFilena = opts === null || opts === void 0 ? void 0 : opts.transformFilename) !== null && _opts$transformFilena !== void 0 ? _opts$transformFilena : (x) => x,
        schema: {
          alt: (_opts$schema$alt = opts === null || opts === void 0 || (_opts$schema = opts.schema) === null || _opts$schema === void 0 ? void 0 : _opts$schema.alt) !== null && _opts$schema$alt !== void 0 ? _opts$schema$alt : defaultAltField,
          title: (_opts$schema$title = opts === null || opts === void 0 || (_opts$schema2 = opts.schema) === null || _opts$schema2 === void 0 ? void 0 : _opts$schema2.title) !== null && _opts$schema$title !== void 0 ? _opts$schema$title : emptyTitleField
        }
      };
    })() : void 0,
    divider: (_options$divider = options.divider) !== null && _options$divider !== void 0 ? _options$divider : true,
    codeBlock: options.codeBlock === false ? void 0 : {
      schema: typeof options.codeBlock === "object" ? options.codeBlock.schema : {}
    }
  };
}
function getTypeForField(field) {
  if (field.kind === "object" || field.kind === "conditional") {
    return {
      type: Object,
      required: true
    };
  }
  if (field.kind === "array") {
    return {
      type: Array,
      required: true
    };
  }
  if (field.kind === "child") {
    return {};
  }
  if (field.formKind === void 0) {
    if (typeof field.defaultValue === "string" && "options" in field && Array.isArray(field.options) && field.options.every((val) => typeof val === "object" && val !== null && "value" in val && typeof val.value === "string")) {
      return {
        type: String,
        matches: field.options.map((x) => x.value),
        required: true
      };
    }
    if (typeof field.defaultValue === "string") {
      let required = false;
      try {
        field.parse("");
      } catch {
        required = true;
      }
      return {
        type: String,
        required
      };
    }
    try {
      field.parse(1);
      return {
        type: Number
      };
    } catch {
    }
    if (typeof field.defaultValue === "boolean") {
      return {
        type: Boolean,
        required: true
      };
    }
    return {};
  }
  if (field.formKind === "slug") {
    let required = false;
    try {
      field.parse("", void 0);
    } catch {
      required = true;
    }
    return {
      type: String,
      required
    };
  }
  if (field.formKind === "asset") {
    let required = false;
    try {
      field.validate(null);
    } catch {
      required = true;
    }
    return {
      type: String,
      required
    };
  }
  return {};
}
function fieldsToMarkdocAttributes(fields) {
  return Object.fromEntries(Object.entries(fields).map(([name, field]) => {
    const schema = getTypeForField(field);
    return [name, schema];
  }));
}
function createMarkdocConfig(opts) {
  const editorConfig = editorOptionsToConfig(opts.options || {});
  const config2 = {
    nodes: {
      ...schema_exports
    },
    tags: {}
  };
  if (editorConfig.heading.levels.length) {
    config2.nodes.heading = {
      ...schema_exports.heading,
      attributes: {
        ...schema_exports.heading.attributes,
        ...fieldsToMarkdocAttributes(editorConfig.heading.schema)
      }
    };
  } else {
    config2.nodes.heading = void 0;
  }
  if (!editorConfig.blockquote) {
    config2.nodes.blockquote = void 0;
  }
  if (editorConfig.codeBlock) {
    config2.nodes.fence = {
      ...schema_exports.fence,
      attributes: {
        ...schema_exports.fence.attributes,
        ...fieldsToMarkdocAttributes(editorConfig.codeBlock.schema)
      }
    };
  } else {
    config2.nodes.fence = void 0;
  }
  if (!editorConfig.orderedList && !editorConfig.unorderedList) {
    config2.nodes.list = void 0;
  }
  if (!editorConfig.bold) {
    config2.nodes.strong = void 0;
  }
  if (!editorConfig.italic) {
    config2.nodes.em = void 0;
  }
  if (!editorConfig.strikethrough) {
    config2.nodes.s = void 0;
  }
  if (!editorConfig.link) {
    config2.nodes.link = void 0;
  }
  if (!editorConfig.image) {
    config2.nodes.image = void 0;
  }
  if (!editorConfig.divider) {
    config2.nodes.hr = void 0;
  }
  if (!editorConfig.table) {
    config2.nodes.table = void 0;
  }
  for (const [name, component2] of Object.entries(opts.components || {})) {
    var _opts$render;
    const isEmpty = component2.kind === "block" || component2.kind === "inline";
    config2.tags[name] = {
      render: (_opts$render = opts.render) === null || _opts$render === void 0 || (_opts$render = _opts$render.tags) === null || _opts$render === void 0 ? void 0 : _opts$render[name],
      children: isEmpty ? [] : void 0,
      selfClosing: isEmpty,
      attributes: fieldsToMarkdocAttributes(component2.schema),
      description: "description" in component2 ? component2.description : void 0,
      inline: component2.kind === "inline" || component2.kind === "mark"
    };
  }
  for (const [name, render3] of Object.entries(((_opts$render2 = opts.render) === null || _opts$render2 === void 0 ? void 0 : _opts$render2.nodes) || {})) {
    var _opts$render2;
    const nodeSchema = config2.nodes[name];
    if (nodeSchema) {
      nodeSchema.render = render3;
    }
  }
  return config2;
}
function getDirectoriesForEditorField(components, config2) {
  return [...collectDirectoriesUsedInSchema(object(Object.fromEntries(Object.entries(components).map(([name, component2]) => [name, object(component2.schema)])))), ...typeof config2.image === "object" && typeof config2.image.directory === "string" ? [fixPath(config2.image.directory)] : []];
}
function markdoc({
  label,
  description,
  options = {},
  components = {},
  extension = "mdoc"
}) {
  let schema;
  const config2 = editorOptionsToConfig(options);
  let getSchema = /* @__PURE__ */ __name(() => {
    if (!schema) {
      schema = createEditorSchema();
    }
    return schema;
  }, "getSchema");
  return {
    kind: "form",
    formKind: "content",
    defaultValue() {
      return getDefaultValue(getSchema());
    },
    Input(props) {
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(DocumentFieldInput, {
        description,
        label,
        ...props
      });
    },
    parse: /* @__PURE__ */ __name((_, {
      content,
      other,
      external,
      slug: slug2
    }) => {
      const text3 = textDecoder.decode(content);
      return parseToEditorState(text3, getSchema());
    }, "parse"),
    contentExtension: `.${extension}`,
    validate(value) {
      return value;
    },
    directories: getDirectoriesForEditorField(components, config2),
    serialize(value, {
      slug: slug2
    }) {
      const out = serializeFromEditorState();
      return {
        content: textEncoder.encode(out.content),
        external: out.external,
        other: out.other,
        value: void 0
      };
    },
    reader: {
      parse: /* @__PURE__ */ __name((_, {
        content
      }) => {
        const text3 = textDecoder.decode(content);
        return {
          node: parse3(text3)
        };
      }, "parse")
    },
    collaboration: {
      toYjs(value) {
        return prosemirrorToYXmlFragment(value.doc);
      },
      fromYjs(yjsValue, awareness) {
        return createEditorStateFromYJS(getSchema());
      }
    }
  };
}
function mdx({
  label,
  description,
  options = {},
  components = {},
  extension = "mdx"
}) {
  let schema;
  const config2 = editorOptionsToConfig(options);
  let getSchema = /* @__PURE__ */ __name(() => {
    if (!schema) {
      schema = createEditorSchema();
    }
    return schema;
  }, "getSchema");
  return {
    kind: "form",
    formKind: "content",
    defaultValue() {
      return getDefaultValue(getSchema());
    },
    Input(props) {
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(DocumentFieldInput, {
        description,
        label,
        ...props
      });
    },
    parse: /* @__PURE__ */ __name((_, {
      content,
      other,
      external,
      slug: slug2
    }) => {
      const text3 = textDecoder.decode(content);
      return parseToEditorStateMDX(text3, getSchema());
    }, "parse"),
    contentExtension: `.${extension}`,
    validate(value) {
      return value;
    },
    directories: getDirectoriesForEditorField(components, config2),
    serialize(value, {
      slug: slug2
    }) {
      const out = serializeFromEditorStateMDX();
      return {
        content: textEncoder.encode(out.content),
        external: out.external,
        other: out.other,
        value: void 0
      };
    },
    reader: {
      parse: /* @__PURE__ */ __name((_, {
        content
      }) => {
        const text3 = textDecoder.decode(content);
        return text3;
      }, "parse")
    },
    collaboration: {
      toYjs(value) {
        return prosemirrorToYXmlFragment(value.doc);
      },
      fromYjs(yjsValue, awareness) {
        return createEditorStateFromYJS(getSchema());
      }
    }
  };
}
var import_assertions, import_emery, import_jsx_runtime2, currentlyActiveMarks, currentlyDisabledMarks, currentLink, VariableChildFields, emptyCacheNode, collectionPath, getFormatInfo, ContentFieldLocationError, textEncoder$1, textDecoder$1, defaultAltField$1, emptyTitleField$1, defaultAltField, emptyTitleField, textDecoder, textEncoder;
var init_index_382895ba_worker = __esm({
  "../node_modules/@keystatic/core/dist/index-382895ba.worker.js"() {
    init_functionsRoutes_0_8824942990098752();
    init_dist2();
    import_assertions = __toESM(require_emery_assertions_cjs(), 1);
    import_emery = __toESM(require_emery_cjs(), 1);
    init_index_08620d62_worker();
    import_jsx_runtime2 = __toESM(require_jsx_runtime(), 1);
    __name(object, "object");
    __name(getValueAtPropPath, "getValueAtPropPath");
    __name(transformProps, "transformProps");
    currentlyActiveMarks = /* @__PURE__ */ new Set();
    currentlyDisabledMarks = /* @__PURE__ */ new Set();
    currentLink = null;
    __name(addMarkToChildren, "addMarkToChildren");
    __name(setLinkForChildren, "setLinkForChildren");
    __name(getInlineNodes, "getInlineNodes");
    VariableChildFields = class extends Error {
      static {
        __name(this, "VariableChildFields");
      }
      constructor() {
        super("There are a variable number of child fields");
      }
    };
    __name(findSingleChildField, "findSingleChildField");
    __name(_findConstantChildFields, "_findConstantChildFields");
    __name(couldContainChildField, "couldContainChildField");
    __name(inlineNodeFromMarkdoc, "inlineNodeFromMarkdoc");
    __name(inlineChildrenFromMarkdoc, "inlineChildrenFromMarkdoc");
    __name(inlineFromMarkdoc, "inlineFromMarkdoc");
    __name(fromMarkdoc, "fromMarkdoc");
    __name(fromMarkdocNode, "fromMarkdocNode");
    __name(toChildrenAndProps, "toChildrenAndProps");
    emptyCacheNode = Symbol("emptyCacheNode");
    __name(memoize, "memoize");
    __name(fixPath, "fixPath");
    collectionPath = /\/\*\*?(?:$|\/)/;
    __name(getConfiguredCollectionPath, "getConfiguredCollectionPath");
    getFormatInfo = memoize(_getFormatInfo);
    __name(_getFormatInfo, "_getFormatInfo");
    ContentFieldLocationError = class extends Error {
      static {
        __name(this, "ContentFieldLocationError");
      }
      constructor(message) {
        super(message);
      }
    };
    __name(getContentExtension, "getContentExtension");
    __name(getSrcPrefix, "getSrcPrefix");
    __name(deserializeFiles, "deserializeFiles");
    __name(deserializeProps, "deserializeProps");
    __name(getSrcPrefixForImageBlock, "getSrcPrefixForImageBlock");
    textEncoder$1 = new TextEncoder();
    textEncoder$1.encode("tree ");
    __name(collectDirectoriesUsedInSchemaInner, "collectDirectoriesUsedInSchemaInner");
    __name(collectDirectoriesUsedInSchema, "collectDirectoriesUsedInSchema");
    textDecoder$1 = new TextDecoder();
    defaultAltField$1 = text2({
      label: "Alt text",
      description: "This text will be used by screen readers and search engines."
    });
    emptyTitleField$1 = basicFormFieldWithSimpleReaderParse({
      Input() {
        return null;
      },
      defaultValue() {
        return "";
      },
      parse(value) {
        if (value === void 0) return "";
        if (typeof value !== "string") {
          throw new FieldDataError("Must be string");
        }
        return value;
      },
      validate(value) {
        return value;
      },
      serialize(value) {
        return {
          value
        };
      },
      label: "Title"
    });
    __name(normaliseDocumentFeatures, "normaliseDocumentFeatures");
    __name(document2, "document");
    defaultAltField = text2({
      label: "Alt text",
      description: "This text will be used by screen readers and search engines."
    });
    emptyTitleField = basicFormFieldWithSimpleReaderParse({
      Input() {
        return null;
      },
      defaultValue() {
        return "";
      },
      parse(value) {
        if (value === void 0) return "";
        if (typeof value !== "string") {
          throw new FieldDataError("Must be string");
        }
        return value;
      },
      validate(value) {
        return value;
      },
      serialize(value) {
        return {
          value
        };
      },
      label: "Title"
    });
    __name(editorOptionsToConfig, "editorOptionsToConfig");
    __name(getTypeForField, "getTypeForField");
    __name(fieldsToMarkdocAttributes, "fieldsToMarkdocAttributes");
    __name(createMarkdocConfig, "createMarkdocConfig");
    textDecoder = new TextDecoder();
    textEncoder = new TextEncoder();
    __name(getDirectoriesForEditorField, "getDirectoriesForEditorField");
    __name(markdoc, "markdoc");
    markdoc.createMarkdocConfig = createMarkdocConfig;
    markdoc.inline = /* @__PURE__ */ __name(function inlineMarkdoc({
      label,
      description,
      options = {},
      components = {}
    }) {
      let schema;
      const config2 = editorOptionsToConfig(options);
      let getSchema = /* @__PURE__ */ __name(() => {
        if (!schema) {
          schema = createEditorSchema();
        }
        return schema;
      }, "getSchema");
      return {
        kind: "form",
        formKind: "assets",
        defaultValue() {
          return getDefaultValue(getSchema());
        },
        Input(props) {
          return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(DocumentFieldInput, {
            description,
            label,
            ...props
          });
        },
        parse: /* @__PURE__ */ __name((value, {
          other,
          external,
          slug: slug2
        }) => {
          if (value === void 0) {
            value = "";
          }
          if (typeof value !== "string") {
            throw new FieldDataError("Must be a string");
          }
          return parseToEditorState(value, getSchema());
        }, "parse"),
        validate(value) {
          return value;
        },
        directories: getDirectoriesForEditorField(components, config2),
        serialize(value, {
          slug: slug2
        }) {
          const out = serializeFromEditorState();
          return {
            external: out.external,
            other: out.other,
            value: out.content
          };
        },
        reader: {
          parse: /* @__PURE__ */ __name((value) => {
            if (value === void 0) {
              value = "";
            }
            if (typeof value !== "string") {
              throw new FieldDataError("Must be a string");
            }
            return {
              node: parse3(value)
            };
          }, "parse")
        },
        collaboration: {
          toYjs(value) {
            return prosemirrorToYXmlFragment(value.doc);
          },
          fromYjs(yjsValue, awareness) {
            return createEditorStateFromYJS(getSchema());
          }
        }
      };
    }, "inlineMarkdoc");
    __name(mdx, "mdx");
    mdx.inline = /* @__PURE__ */ __name(function mdx2({
      label,
      description,
      options = {},
      components = {}
    }) {
      let schema;
      const config2 = editorOptionsToConfig(options);
      let getSchema = /* @__PURE__ */ __name(() => {
        if (!schema) {
          schema = createEditorSchema();
        }
        return schema;
      }, "getSchema");
      return {
        kind: "form",
        formKind: "assets",
        defaultValue() {
          return getDefaultValue(getSchema());
        },
        Input(props) {
          return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(DocumentFieldInput, {
            description,
            label,
            ...props
          });
        },
        parse: /* @__PURE__ */ __name((value, {
          other,
          external,
          slug: slug2
        }) => {
          if (value === void 0) {
            value = "";
          }
          if (typeof value !== "string") {
            throw new FieldDataError("Must be a string");
          }
          return parseToEditorStateMDX(value, getSchema());
        }, "parse"),
        validate(value) {
          return value;
        },
        directories: getDirectoriesForEditorField(components, config2),
        serialize(value, {
          slug: slug2
        }) {
          const out = serializeFromEditorStateMDX();
          return {
            external: out.external,
            other: out.other,
            value: out.content
          };
        },
        reader: {
          parse: /* @__PURE__ */ __name((value) => {
            if (value === void 0) {
              value = "";
            }
            if (typeof value !== "string") {
              throw new FieldDataError("Must be a string");
            }
            return value;
          }, "parse")
        },
        collaboration: {
          toYjs(value) {
            return prosemirrorToYXmlFragment(value.doc);
          },
          fromYjs(yjsValue, awareness) {
            return createEditorStateFromYJS(getSchema());
          }
        }
      };
    }, "mdx");
  }
});

// ../node_modules/@braintree/sanitize-url/dist/index.js
var require_dist2 = __commonJS({
  "../node_modules/@braintree/sanitize-url/dist/index.js"(exports) {
    "use strict";
    init_functionsRoutes_0_8824942990098752();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.sanitizeUrl = exports.BLANK_URL = void 0;
    var invalidProtocolRegex = /^([^\w]*)(javascript|data|vbscript)/im;
    var htmlEntitiesRegex = /&#(\w+)(^\w|;)?/g;
    var htmlCtrlEntityRegex = /&(newline|tab);/gi;
    var ctrlCharactersRegex = /[\u0000-\u001F\u007F-\u009F\u2000-\u200D\uFEFF]/gim;
    var urlSchemeRegex = /^.+(:|&colon;)/gim;
    var relativeFirstCharacters = [".", "/"];
    exports.BLANK_URL = "about:blank";
    function isRelativeUrlWithoutProtocol(url2) {
      return relativeFirstCharacters.indexOf(url2[0]) > -1;
    }
    __name(isRelativeUrlWithoutProtocol, "isRelativeUrlWithoutProtocol");
    function decodeHtmlCharacters(str) {
      var removedNullByte = str.replace(ctrlCharactersRegex, "");
      return removedNullByte.replace(htmlEntitiesRegex, function(match2, dec) {
        return String.fromCharCode(dec);
      });
    }
    __name(decodeHtmlCharacters, "decodeHtmlCharacters");
    function sanitizeUrl2(url2) {
      if (!url2) {
        return exports.BLANK_URL;
      }
      var sanitizedUrl = decodeHtmlCharacters(url2).replace(htmlCtrlEntityRegex, "").replace(ctrlCharactersRegex, "").trim();
      if (!sanitizedUrl) {
        return exports.BLANK_URL;
      }
      if (isRelativeUrlWithoutProtocol(sanitizedUrl)) {
        return sanitizedUrl;
      }
      var urlSchemeParseResults = sanitizedUrl.match(urlSchemeRegex);
      if (!urlSchemeParseResults) {
        return sanitizedUrl;
      }
      var urlScheme = urlSchemeParseResults[0];
      if (invalidProtocolRegex.test(urlScheme)) {
        return exports.BLANK_URL;
      }
      return sanitizedUrl;
    }
    __name(sanitizeUrl2, "sanitizeUrl");
    exports.sanitizeUrl = sanitizeUrl2;
  }
});

// ../node_modules/@keystatic/core/dist/api-2c36c7e1.worker.js
var import_jsx_runtime3, import_emery2, import_sanitize_url;
var init_api_2c36c7e1_worker = __esm({
  "../node_modules/@keystatic/core/dist/api-2c36c7e1.worker.js"() {
    init_functionsRoutes_0_8824942990098752();
    import_jsx_runtime3 = __toESM(require_jsx_runtime(), 1);
    init_index_382895ba_worker();
    import_emery2 = __toESM(require_emery_cjs(), 1);
    import_sanitize_url = __toESM(require_dist2(), 1);
  }
});

// ../node_modules/@keystatic/core/dist/index-83fb8e35.worker.js
function validateInteger(validation, value, label) {
  if (value !== null && (typeof value !== "number" || !Number.isInteger(value))) {
    return `${label} must be a whole number`;
  }
  if (validation !== null && validation !== void 0 && validation.isRequired && value === null) {
    return `${label} is required`;
  }
  if (value !== null) {
    if ((validation === null || validation === void 0 ? void 0 : validation.min) !== void 0 && value < validation.min) {
      return `${label} must be at least ${validation.min}`;
    }
    if ((validation === null || validation === void 0 ? void 0 : validation.max) !== void 0 && value > validation.max) {
      return `${label} must be at most ${validation.max}`;
    }
  }
}
function integer({
  label,
  defaultValue,
  validation,
  description
}) {
  return basicFormFieldWithSimpleReaderParse({
    label,
    Input(props) {
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IntegerFieldInput, {
        label,
        description,
        validation,
        ...props
      });
    },
    defaultValue() {
      return defaultValue !== null && defaultValue !== void 0 ? defaultValue : null;
    },
    parse(value) {
      if (value === void 0) {
        return null;
      }
      if (typeof value === "number") {
        return value;
      }
      throw new FieldDataError("Must be a number");
    },
    validate(value) {
      const message = validateInteger(validation, value, label);
      if (message !== void 0) {
        throw new FieldDataError(message);
      }
      assertRequired(value, validation, label);
      return value;
    },
    serialize(value) {
      return {
        value: value === null ? void 0 : value
      };
    }
  });
}
var import_jsx_runtime4;
var init_index_83fb8e35_worker = __esm({
  "../node_modules/@keystatic/core/dist/index-83fb8e35.worker.js"() {
    init_functionsRoutes_0_8824942990098752();
    init_index_08620d62_worker();
    import_jsx_runtime4 = __toESM(require_jsx_runtime(), 1);
    __name(validateInteger, "validateInteger");
    __name(integer, "integer");
  }
});

// ../node_modules/@keystatic/core/dist/keystatic-core.worker.js
function config(config2) {
  return config2;
}
function collection(collection2) {
  return collection2;
}
function array(element, opts) {
  var _opts$label;
  return {
    kind: "array",
    element,
    label: (_opts$label = opts === null || opts === void 0 ? void 0 : opts.label) !== null && _opts$label !== void 0 ? _opts$label : "Items",
    description: opts === null || opts === void 0 ? void 0 : opts.description,
    itemLabel: opts === null || opts === void 0 ? void 0 : opts.itemLabel,
    asChildTag: opts === null || opts === void 0 ? void 0 : opts.asChildTag,
    slugField: opts === null || opts === void 0 ? void 0 : opts.slugField,
    validation: opts === null || opts === void 0 ? void 0 : opts.validation
  };
}
function select({
  label,
  options,
  defaultValue,
  description
}) {
  const optionValuesSet = new Set(options.map((x) => x.value));
  if (!optionValuesSet.has(defaultValue)) {
    throw new Error(`A defaultValue of ${defaultValue} was provided to a select field but it does not match the value of one of the options provided`);
  }
  const field = basicFormFieldWithSimpleReaderParse({
    label,
    Input(props) {
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(SelectFieldInput, {
        label,
        options,
        description,
        ...props
      });
    },
    defaultValue() {
      return defaultValue;
    },
    parse(value) {
      if (value === void 0) {
        return defaultValue;
      }
      if (typeof value !== "string") {
        throw new FieldDataError("Must be a string");
      }
      if (!optionValuesSet.has(value)) {
        throw new FieldDataError("Must be a valid option");
      }
      return value;
    },
    validate(value) {
      return value;
    },
    serialize(value) {
      return {
        value
      };
    }
  });
  return {
    ...field,
    options
  };
}
function conditional(discriminant, values) {
  return {
    kind: "conditional",
    discriminant,
    values
  };
}
function blocks(blocks2, opts) {
  const entries = Object.entries(blocks2);
  if (!entries.length) {
    throw new Error("fields.blocks must have at least one entry");
  }
  const select$1 = select({
    label: "Kind",
    defaultValue: entries[0][0],
    options: Object.entries(blocks2).map(([key, {
      label
    }]) => ({
      label,
      value: key
    }))
  });
  const element = conditional(select$1, Object.fromEntries(entries.map(([key, {
    schema
  }]) => [key, schema])));
  return {
    ...array(element, {
      label: opts.label,
      description: opts.description,
      validation: opts.validation,
      itemLabel(props) {
        const kind = props.discriminant;
        const block4 = blocks2[kind];
        if (!block4.itemLabel) return block4.label;
        return block4.itemLabel(props.value);
      }
    }),
    Input: BlocksFieldInput
  };
}
function checkbox({
  label,
  defaultValue = false,
  description
}) {
  return basicFormFieldWithSimpleReaderParse({
    label,
    Input(props) {
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(CheckboxFieldInput, {
        ...props,
        label,
        description
      });
    },
    defaultValue() {
      return defaultValue;
    },
    parse(value) {
      if (value === void 0) return defaultValue;
      if (typeof value !== "boolean") {
        throw new FieldDataError("Must be a boolean");
      }
      return value;
    },
    validate(value) {
      return value;
    },
    serialize(value) {
      return {
        value
      };
    }
  });
}
function child(options) {
  return {
    kind: "child",
    options: options.kind === "block" ? {
      ...options,
      dividers: options.dividers,
      formatting: options.formatting === "inherit" ? {
        blockTypes: "inherit",
        headingLevels: "inherit",
        inlineMarks: "inherit",
        listTypes: "inherit",
        alignment: "inherit",
        softBreaks: "inherit"
      } : options.formatting,
      links: options.links,
      images: options.images,
      tables: options.tables,
      componentBlocks: options.componentBlocks
    } : {
      kind: "inline",
      placeholder: options.placeholder,
      formatting: options.formatting === "inherit" ? {
        inlineMarks: "inherit",
        softBreaks: "inherit"
      } : options.formatting,
      links: options.links
    }
  };
}
function cloudImage({
  label,
  description,
  validation
}) {
  return {
    ...object({
      src: text2({
        label: "URL",
        validation: {
          length: {
            min: validation !== null && validation !== void 0 && validation.isRequired ? 1 : 0
          }
        }
      }),
      alt: text2({
        label: "Alt text"
      }),
      height: integer({
        label: "Height"
      }),
      width: integer({
        label: "Width"
      })
    }, {
      label,
      description
    }),
    Input(props) {
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(CloudImageFieldInput, {
        ...props,
        isRequired: validation === null || validation === void 0 ? void 0 : validation.isRequired
      });
    }
  };
}
function validateDate(validation, value, label) {
  if (value !== null && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${label} is not a valid date`;
  }
  if (validation !== null && validation !== void 0 && validation.isRequired && value === null) {
    return `${label} is required`;
  }
  if ((validation !== null && validation !== void 0 && validation.min || validation !== null && validation !== void 0 && validation.max) && value !== null) {
    const date2 = new Date(value);
    if ((validation === null || validation === void 0 ? void 0 : validation.min) !== void 0) {
      const min = new Date(validation.min);
      if (date2 < min) {
        return `${label} must be after ${min.toLocaleDateString()}`;
      }
    }
    if ((validation === null || validation === void 0 ? void 0 : validation.max) !== void 0) {
      const max2 = new Date(validation.max);
      if (date2 > max2) {
        return `${label} must be no later than ${max2.toLocaleDateString()}`;
      }
    }
  }
}
function date({
  label,
  defaultValue,
  validation,
  description
}) {
  return basicFormFieldWithSimpleReaderParse({
    label,
    Input(props) {
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(DateFieldInput, {
        validation,
        label,
        description,
        ...props
      });
    },
    defaultValue() {
      if (defaultValue === void 0) {
        return null;
      }
      if (typeof defaultValue === "string") {
        return defaultValue;
      }
      const today = /* @__PURE__ */ new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    },
    parse(value) {
      if (value === void 0) {
        return null;
      }
      if (value instanceof Date) {
        const year = value.getUTCFullYear();
        const month = String(value.getUTCMonth() + 1).padStart(2, "0");
        const day = String(value.getUTCDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
      if (typeof value !== "string") {
        throw new FieldDataError("Must be a string");
      }
      return value;
    },
    serialize(value) {
      if (value === null) return {
        value: void 0
      };
      const date2 = new Date(value);
      date2.toISOString = () => value;
      date2.toString = () => value;
      return {
        value: date2
      };
    },
    validate(value) {
      const message = validateDate(validation, value, label);
      if (message !== void 0) {
        throw new FieldDataError(message);
      }
      assertRequired(value, validation, label);
      return value;
    }
  });
}
function validateDatetime(validation, value, label) {
  if (value !== null && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return `${label} is not a valid datetime`;
  }
  if (validation !== null && validation !== void 0 && validation.isRequired && value === null) {
    return `${label} is required`;
  }
  if ((validation !== null && validation !== void 0 && validation.min || validation !== null && validation !== void 0 && validation.max) && value !== null) {
    const datetime2 = new Date(value);
    if ((validation === null || validation === void 0 ? void 0 : validation.min) !== void 0) {
      const min = new Date(validation.min);
      if (datetime2 < min) {
        return `${label} must be after ${min.toISOString()}`;
      }
    }
    if ((validation === null || validation === void 0 ? void 0 : validation.max) !== void 0) {
      const max2 = new Date(validation.max);
      if (datetime2 > max2) {
        return `${label} must be no later than ${max2.toISOString()}`;
      }
    }
  }
}
function datetime({
  label,
  defaultValue,
  validation,
  description
}) {
  return basicFormFieldWithSimpleReaderParse({
    label,
    Input(props) {
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(DatetimeFieldInput, {
        validation,
        label,
        description,
        ...props
      });
    },
    defaultValue() {
      if (defaultValue === void 0) {
        return null;
      }
      if (typeof defaultValue === "string") {
        return defaultValue;
      }
      if (defaultValue.kind === "now") {
        const now = /* @__PURE__ */ new Date();
        return new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1e3).toISOString().slice(0, -8);
      }
      return null;
    },
    parse(value) {
      if (value === void 0) {
        return null;
      }
      if (value instanceof Date) {
        return value.toISOString().slice(0, -8);
      }
      if (typeof value !== "string") {
        throw new FieldDataError("Must be a string or date");
      }
      return value;
    },
    serialize(value) {
      if (value === null) return {
        value: void 0
      };
      const date2 = /* @__PURE__ */ new Date(value + "Z");
      date2.toJSON = () => date2.toISOString().slice(0, -8);
      date2.toString = () => date2.toISOString().slice(0, -8);
      return {
        value: date2
      };
    },
    validate(value) {
      const message = validateDatetime(validation, value, label);
      if (message !== void 0) {
        throw new FieldDataError(message);
      }
      assertRequired(value, validation, label);
      return value;
    }
  });
}
function empty2() {
  return basicFormFieldWithSimpleReaderParse({
    Input() {
      return null;
    },
    defaultValue() {
      return null;
    },
    parse() {
      return null;
    },
    serialize() {
      return {
        value: void 0
      };
    },
    validate(value) {
      return value;
    },
    label: "Empty"
  });
}
function emptyDocument() {
  return {
    kind: "form",
    formKind: "content",
    Input() {
      return null;
    },
    defaultValue() {
      return null;
    },
    parse() {
      return null;
    },
    contentExtension: ".mdoc",
    serialize() {
      return {
        value: void 0,
        content: new Uint8Array(),
        external: /* @__PURE__ */ new Map(),
        other: /* @__PURE__ */ new Map()
      };
    },
    validate(value) {
      return value;
    },
    reader: {
      parse() {
        return null;
      }
    }
  };
}
function emptyContent(opts) {
  return {
    kind: "form",
    formKind: "content",
    Input() {
      return null;
    },
    defaultValue() {
      return null;
    },
    parse() {
      return null;
    },
    contentExtension: `.${opts.extension}`,
    serialize() {
      return {
        value: void 0,
        content: new Uint8Array(),
        external: /* @__PURE__ */ new Map(),
        other: /* @__PURE__ */ new Map()
      };
    },
    validate(value) {
      return value;
    },
    reader: {
      parse() {
        return null;
      }
    }
  };
}
function file({
  label,
  directory,
  validation,
  description,
  publicPath,
  transformFilename
}) {
  return {
    kind: "form",
    formKind: "asset",
    label,
    Input(props) {
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(FileFieldInput, {
        label,
        description,
        validation,
        transformFilename,
        ...props
      });
    },
    defaultValue() {
      return null;
    },
    filename(value, args) {
      if (typeof value === "string") {
        return value.slice(getSrcPrefix(publicPath, args.slug).length);
      }
      return void 0;
    },
    parse(value, args) {
      var _value$match$, _value$match;
      if (value === void 0) {
        return null;
      }
      if (typeof value !== "string") {
        throw new FieldDataError("Must be a string");
      }
      if (args.asset === void 0) {
        return null;
      }
      return {
        data: args.asset,
        filename: value.slice(getSrcPrefix(publicPath, args.slug).length),
        extension: (_value$match$ = (_value$match = value.match(/\.([^.]+$)/)) === null || _value$match === void 0 ? void 0 : _value$match[1]) !== null && _value$match$ !== void 0 ? _value$match$ : ""
      };
    },
    validate(value) {
      assertRequired(value, validation, label);
      return value;
    },
    serialize(value, args) {
      if (value === null) {
        return {
          value: void 0,
          asset: void 0
        };
      }
      const filename = args.suggestedFilenamePrefix ? args.suggestedFilenamePrefix + "." + value.extension : value.filename;
      return {
        value: `${getSrcPrefix(publicPath, args.slug)}${filename}`,
        asset: {
          filename,
          content: value.data
        }
      };
    },
    directory: directory ? fixPath(directory) : void 0,
    reader: {
      parse(value) {
        if (typeof value !== "string" && value !== void 0) {
          throw new FieldDataError("Must be a string");
        }
        const val = value === void 0 ? null : value;
        assertRequired(val, validation, label);
        return val;
      }
    }
  };
}
function image2({
  label,
  directory,
  validation,
  description,
  publicPath,
  transformFilename
}) {
  return {
    kind: "form",
    formKind: "asset",
    label,
    Input(props) {
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(ImageFieldInput, {
        label,
        description,
        validation,
        transformFilename,
        ...props
      });
    },
    defaultValue() {
      return null;
    },
    filename(value, args) {
      if (typeof value === "string") {
        return value.slice(getSrcPrefix(publicPath, args.slug).length);
      }
      return void 0;
    },
    parse(value, args) {
      var _value$match$, _value$match;
      if (value === void 0) {
        return null;
      }
      if (typeof value !== "string") {
        throw new FieldDataError("Must be a string");
      }
      if (args.asset === void 0) {
        return null;
      }
      return {
        data: args.asset,
        filename: value.slice(getSrcPrefix(publicPath, args.slug).length),
        extension: (_value$match$ = (_value$match = value.match(/\.([^.]+$)/)) === null || _value$match === void 0 ? void 0 : _value$match[1]) !== null && _value$match$ !== void 0 ? _value$match$ : ""
      };
    },
    validate(value) {
      assertRequired(value, validation, label);
      return value;
    },
    serialize(value, args) {
      if (value === null) {
        return {
          value: void 0,
          asset: void 0
        };
      }
      const filename = args.suggestedFilenamePrefix ? args.suggestedFilenamePrefix + "." + value.extension : value.filename;
      return {
        value: `${getSrcPrefix(publicPath, args.slug)}${filename}`,
        asset: {
          filename,
          content: value.data
        }
      };
    },
    directory: directory ? fixPath(directory) : void 0,
    reader: {
      parse(value) {
        if (typeof value !== "string" && value !== void 0) {
          throw new FieldDataError("Must be a string");
        }
        const val = value === void 0 ? null : value;
        assertRequired(val, validation, label);
        return val;
      }
    }
  };
}
function pluralize(count, options) {
  const {
    singular,
    plural = singular + "s",
    inclusive = true
  } = options;
  const variant = count === 1 ? singular : plural;
  return inclusive ? `${count} ${variant}` : variant;
}
function validateMultiRelationshipLength(validation, value) {
  var _validation$length$mi, _validation$length, _validation$length$ma, _validation$length2;
  const minLength = (_validation$length$mi = validation === null || validation === void 0 || (_validation$length = validation.length) === null || _validation$length === void 0 ? void 0 : _validation$length.min) !== null && _validation$length$mi !== void 0 ? _validation$length$mi : 0;
  if (value.length < minLength) {
    return `Must have at least ${pluralize(minLength, {
      singular: "item"
    })}.`;
  }
  const maxLength = (_validation$length$ma = validation === null || validation === void 0 || (_validation$length2 = validation.length) === null || _validation$length2 === void 0 ? void 0 : _validation$length2.max) !== null && _validation$length$ma !== void 0 ? _validation$length$ma : Infinity;
  if (value.length > maxLength) {
    return `Must have at most ${pluralize(maxLength, {
      singular: "item"
    })}.`;
  }
}
function multiRelationship({
  label,
  collection: collection2,
  validation,
  description
}) {
  return basicFormFieldWithSimpleReaderParse({
    label,
    Input(props) {
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(MultiRelationshipInput, {
        label,
        collection: collection2,
        description,
        validation,
        ...props
      });
    },
    defaultValue() {
      return [];
    },
    parse(value) {
      if (value === void 0) {
        return [];
      }
      if (!Array.isArray(value) || !value.every(import_emery3.isString)) {
        throw new FieldDataError("Must be an array of strings");
      }
      return value;
    },
    validate(value) {
      const error2 = validateMultiRelationshipLength(validation, value);
      if (error2) {
        throw new FieldDataError(error2);
      }
      return value;
    },
    serialize(value) {
      return {
        value
      };
    }
  });
}
function multiselect({
  label,
  options,
  defaultValue = [],
  description
}) {
  const valuesToOption = new Map(options.map((x) => [x.value, x]));
  const field = basicFormFieldWithSimpleReaderParse({
    label,
    Input(props) {
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(MultiselectFieldInput, {
        label,
        description,
        options,
        ...props
      });
    },
    defaultValue() {
      return defaultValue;
    },
    parse(value) {
      if (value === void 0) {
        return [];
      }
      if (!Array.isArray(value)) {
        throw new FieldDataError("Must be an array of options");
      }
      if (!value.every((x) => typeof x === "string" && valuesToOption.has(x))) {
        throw new FieldDataError(`Must be an array with one of ${options.map((x) => x.value).join(", ")}`);
      }
      return value;
    },
    validate(value) {
      return value;
    },
    serialize(value) {
      return {
        value
      };
    }
  });
  return {
    ...field,
    options
  };
}
function validateNumber(validation, value, step, label) {
  if (value !== null && typeof value !== "number") {
    return `${label} must be a number`;
  }
  if (validation !== null && validation !== void 0 && validation.isRequired && value === null) {
    return `${label} is required`;
  }
  if (value !== null) {
    if ((validation === null || validation === void 0 ? void 0 : validation.min) !== void 0 && value < validation.min) {
      return `${label} must be at least ${validation.min}`;
    }
    if ((validation === null || validation === void 0 ? void 0 : validation.max) !== void 0 && value > validation.max) {
      return `${label} must be at most ${validation.max}`;
    }
    if (step !== void 0 && (validation === null || validation === void 0 ? void 0 : validation.validateStep) !== void 0 && !isAtStep(value, step)) {
      return `${label} must be a multiple of ${step}`;
    }
  }
}
function decimalPlaces(value) {
  const stringified = value.toString();
  const indexOfDecimal = stringified.indexOf(".");
  if (indexOfDecimal === -1) {
    const indexOfE = stringified.indexOf("e-");
    return indexOfE === -1 ? 0 : parseInt(stringified.slice(indexOfE + 2));
  }
  return stringified.length - indexOfDecimal - 1;
}
function isAtStep(value, step) {
  const dc = Math.max(decimalPlaces(step), decimalPlaces(value));
  const base = Math.pow(10, dc);
  return value * base % (step * base) === 0;
}
function number2({
  label,
  defaultValue,
  step,
  validation,
  description
}) {
  return basicFormFieldWithSimpleReaderParse({
    label,
    Input(props) {
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(NumberFieldInput, {
        label,
        description,
        validation,
        step,
        ...props
      });
    },
    defaultValue() {
      return defaultValue !== null && defaultValue !== void 0 ? defaultValue : null;
    },
    parse(value) {
      if (value === void 0) {
        return null;
      }
      if (typeof value === "number") {
        return value;
      }
      throw new FieldDataError("Must be a number");
    },
    validate(value) {
      const message = validateNumber(validation, value, step, label);
      if (message !== void 0) {
        throw new FieldDataError(message);
      }
      assertRequired(value, validation, label);
      return value;
    },
    serialize(value) {
      return {
        value: value === null ? void 0 : value
      };
    }
  });
}
function pathReference({
  label,
  pattern,
  validation,
  description
}) {
  return basicFormFieldWithSimpleReaderParse({
    label,
    Input(props) {
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(PathReferenceInput, {
        label,
        pattern,
        description,
        validation,
        ...props
      });
    },
    defaultValue() {
      return null;
    },
    parse(value) {
      if (value === void 0) {
        return null;
      }
      if (typeof value !== "string") {
        throw new FieldDataError("Must be a string");
      }
      return value;
    },
    validate(value) {
      assertRequired(value, validation, label);
      return value;
    },
    serialize(value) {
      return {
        value: value === null ? void 0 : value
      };
    }
  });
}
function relationship({
  label,
  collection: collection2,
  validation,
  description
}) {
  return basicFormFieldWithSimpleReaderParse({
    label,
    Input(props) {
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(RelationshipInput, {
        label,
        collection: collection2,
        description,
        validation,
        ...props
      });
    },
    defaultValue() {
      return null;
    },
    parse(value) {
      if (value === void 0) {
        return null;
      }
      if (typeof value !== "string") {
        throw new FieldDataError("Must be a string");
      }
      return value;
    },
    validate(value) {
      assertRequired(value, validation, label);
      return value;
    },
    serialize(value) {
      return {
        value: value === null ? void 0 : value
      };
    }
  });
}
function parseSlugFieldAsNormalField(value) {
  if (value === void 0) {
    return {
      name: "",
      slug: ""
    };
  }
  if (typeof value !== "object") {
    throw new FieldDataError("Must be an object");
  }
  if (Object.keys(value).length !== 2) {
    throw new FieldDataError("Unexpected keys");
  }
  if (!("name" in value) || !("slug" in value)) {
    throw new FieldDataError("Missing name or slug");
  }
  if (typeof value.name !== "string") {
    throw new FieldDataError("name must be a string");
  }
  if (typeof value.slug !== "string") {
    throw new FieldDataError("slug must be a string");
  }
  return {
    name: value.name,
    slug: value.slug
  };
}
function parseAsSlugField(value, slug2) {
  if (value === void 0) {
    return {
      name: "",
      slug: slug2
    };
  }
  if (typeof value !== "string") {
    throw new FieldDataError("Must be a string");
  }
  return {
    name: value,
    slug: slug2
  };
}
function slug(_args) {
  var _args$name$validation, _args$name$validation2, _args$name$validation3, _args$name$validation4, _args$name$validation5, _args$slug;
  const args = {
    ..._args,
    name: {
      ..._args.name,
      validation: {
        pattern: (_args$name$validation = _args.name.validation) === null || _args$name$validation === void 0 ? void 0 : _args$name$validation.pattern,
        length: {
          min: Math.max((_args$name$validation2 = _args.name.validation) !== null && _args$name$validation2 !== void 0 && _args$name$validation2.isRequired ? 1 : 0, (_args$name$validation3 = (_args$name$validation4 = _args.name.validation) === null || _args$name$validation4 === void 0 || (_args$name$validation4 = _args$name$validation4.length) === null || _args$name$validation4 === void 0 ? void 0 : _args$name$validation4.min) !== null && _args$name$validation3 !== void 0 ? _args$name$validation3 : 0),
          max: (_args$name$validation5 = _args.name.validation) === null || _args$name$validation5 === void 0 || (_args$name$validation5 = _args$name$validation5.length) === null || _args$name$validation5 === void 0 ? void 0 : _args$name$validation5.max
        }
      }
    }
  };
  const naiveGenerateSlug = ((_args$slug = args.slug) === null || _args$slug === void 0 ? void 0 : _args$slug.generate) || slugify;
  let _defaultValue;
  function defaultValue() {
    if (!_defaultValue) {
      var _args$name$defaultVal, _args$name$defaultVal2;
      _defaultValue = {
        name: (_args$name$defaultVal = args.name.defaultValue) !== null && _args$name$defaultVal !== void 0 ? _args$name$defaultVal : "",
        slug: naiveGenerateSlug((_args$name$defaultVal2 = args.name.defaultValue) !== null && _args$name$defaultVal2 !== void 0 ? _args$name$defaultVal2 : "")
      };
    }
    return _defaultValue;
  }
  __name(defaultValue, "defaultValue");
  function validate3(value, {
    slugField
  } = {
    slugField: void 0
  }) {
    var _args$name$validation6, _args$name$validation7, _args$name$validation8, _args$name$validation9, _args$name$validation10, _args$slug$validation, _args$slug2, _args$slug$validation2, _args$slug3, _args$slug$label, _args$slug4, _args$slug5;
    const nameMessage = validateText(value.name, (_args$name$validation6 = (_args$name$validation7 = args.name.validation) === null || _args$name$validation7 === void 0 || (_args$name$validation7 = _args$name$validation7.length) === null || _args$name$validation7 === void 0 ? void 0 : _args$name$validation7.min) !== null && _args$name$validation6 !== void 0 ? _args$name$validation6 : 0, (_args$name$validation8 = (_args$name$validation9 = args.name.validation) === null || _args$name$validation9 === void 0 || (_args$name$validation9 = _args$name$validation9.length) === null || _args$name$validation9 === void 0 ? void 0 : _args$name$validation9.max) !== null && _args$name$validation8 !== void 0 ? _args$name$validation8 : Infinity, args.name.label, void 0, (_args$name$validation10 = args.name.validation) === null || _args$name$validation10 === void 0 ? void 0 : _args$name$validation10.pattern);
    if (nameMessage !== void 0) {
      throw new FieldDataError(nameMessage);
    }
    const slugMessage = validateText(value.slug, (_args$slug$validation = (_args$slug2 = args.slug) === null || _args$slug2 === void 0 || (_args$slug2 = _args$slug2.validation) === null || _args$slug2 === void 0 || (_args$slug2 = _args$slug2.length) === null || _args$slug2 === void 0 ? void 0 : _args$slug2.min) !== null && _args$slug$validation !== void 0 ? _args$slug$validation : 1, (_args$slug$validation2 = (_args$slug3 = args.slug) === null || _args$slug3 === void 0 || (_args$slug3 = _args$slug3.validation) === null || _args$slug3 === void 0 || (_args$slug3 = _args$slug3.length) === null || _args$slug3 === void 0 ? void 0 : _args$slug3.max) !== null && _args$slug$validation2 !== void 0 ? _args$slug$validation2 : Infinity, (_args$slug$label = (_args$slug4 = args.slug) === null || _args$slug4 === void 0 ? void 0 : _args$slug4.label) !== null && _args$slug$label !== void 0 ? _args$slug$label : "Slug", slugField ? slugField : {
      slugs: emptySet2,
      glob: "*"
    }, (_args$slug5 = args.slug) === null || _args$slug5 === void 0 || (_args$slug5 = _args$slug5.validation) === null || _args$slug5 === void 0 ? void 0 : _args$slug5.pattern);
    if (slugMessage !== void 0) {
      throw new FieldDataError(slugMessage);
    }
    return value;
  }
  __name(validate3, "validate");
  const emptySet2 = /* @__PURE__ */ new Set();
  return {
    kind: "form",
    formKind: "slug",
    label: args.name.label,
    Input(props) {
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(SlugFieldInput, {
        args,
        naiveGenerateSlug,
        defaultValue: defaultValue(),
        ...props
      });
    },
    defaultValue,
    parse(value, args2) {
      if ((args2 === null || args2 === void 0 ? void 0 : args2.slug) !== void 0) {
        return parseAsSlugField(value, args2.slug);
      }
      return parseSlugFieldAsNormalField(value);
    },
    validate: validate3,
    serialize(value) {
      return {
        value
      };
    },
    serializeWithSlug(value) {
      return {
        value: value.name,
        slug: value.slug
      };
    },
    reader: {
      parse(value) {
        const parsed = parseSlugFieldAsNormalField(value);
        return validate3(parsed);
      },
      parseWithSlug(value, args2) {
        return validate3(parseAsSlugField(value, args2.slug), {
          slugField: {
            glob: args2.glob,
            slugs: emptySet2
          }
        }).name;
      }
    }
  };
}
function isValidURL(url2) {
  return url2 === (0, import_sanitize_url2.sanitizeUrl)(url2);
}
function validateUrl(validation, value, label) {
  if (value !== null && (typeof value !== "string" || !isValidURL(value))) {
    return `${label} is not a valid URL`;
  }
  if (validation !== null && validation !== void 0 && validation.isRequired && value === null) {
    return `${label} is required`;
  }
}
function url({
  label,
  defaultValue,
  validation,
  description
}) {
  return basicFormFieldWithSimpleReaderParse({
    label,
    Input(props) {
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(UrlFieldInput, {
        label,
        description,
        validation,
        ...props
      });
    },
    defaultValue() {
      return defaultValue || null;
    },
    parse(value) {
      if (value === void 0) {
        return null;
      }
      if (typeof value !== "string") {
        throw new FieldDataError("Must be a string");
      }
      return value === "" ? null : value;
    },
    validate(value) {
      const message = validateUrl(validation, value, label);
      if (message !== void 0) {
        throw new FieldDataError(message);
      }
      assertRequired(value, validation, label);
      return value;
    },
    serialize(value) {
      return {
        value: value === null ? void 0 : value
      };
    }
  });
}
function ignored() {
  return {
    kind: "form",
    Input() {
      return null;
    },
    defaultValue() {
      return {
        value: void 0
      };
    },
    parse(value) {
      return {
        value
      };
    },
    serialize(value) {
      return value;
    },
    validate(value) {
      return value;
    },
    label: "Ignored",
    reader: {
      parse(value) {
        return value;
      }
    }
  };
}
var import_jsx_runtime5, import_emery3, import_sanitize_url2, import_assertions2, index;
var init_keystatic_core_worker = __esm({
  "../node_modules/@keystatic/core/dist/keystatic-core.worker.js"() {
    init_functionsRoutes_0_8824942990098752();
    init_api_2c36c7e1_worker();
    init_index_08620d62_worker();
    import_jsx_runtime5 = __toESM(require_jsx_runtime(), 1);
    init_index_83fb8e35_worker();
    init_index_382895ba_worker();
    import_emery3 = __toESM(require_emery_cjs(), 1);
    import_sanitize_url2 = __toESM(require_dist2(), 1);
    import_assertions2 = __toESM(require_emery_assertions_cjs(), 1);
    __name(config, "config");
    __name(collection, "collection");
    __name(array, "array");
    __name(select, "select");
    __name(conditional, "conditional");
    __name(blocks, "blocks");
    __name(checkbox, "checkbox");
    __name(child, "child");
    __name(cloudImage, "cloudImage");
    __name(validateDate, "validateDate");
    __name(date, "date");
    __name(validateDatetime, "validateDatetime");
    __name(datetime, "datetime");
    __name(empty2, "empty");
    __name(emptyDocument, "emptyDocument");
    __name(emptyContent, "emptyContent");
    __name(file, "file");
    __name(image2, "image");
    __name(pluralize, "pluralize");
    __name(validateMultiRelationshipLength, "validateMultiRelationshipLength");
    __name(multiRelationship, "multiRelationship");
    __name(multiselect, "multiselect");
    __name(validateNumber, "validateNumber");
    __name(decimalPlaces, "decimalPlaces");
    __name(isAtStep, "isAtStep");
    __name(number2, "number");
    __name(pathReference, "pathReference");
    __name(relationship, "relationship");
    __name(parseSlugFieldAsNormalField, "parseSlugFieldAsNormalField");
    __name(parseAsSlugField, "parseAsSlugField");
    __name(slug, "slug");
    __name(isValidURL, "isValidURL");
    __name(validateUrl, "validateUrl");
    __name(url, "url");
    __name(ignored, "ignored");
    index = /* @__PURE__ */ Object.freeze({
      __proto__: null,
      array,
      blocks,
      checkbox,
      child,
      cloudImage,
      conditional,
      date,
      datetime,
      document: document2,
      empty: empty2,
      emptyDocument,
      emptyContent,
      file,
      image: image2,
      integer,
      multiRelationship,
      multiselect,
      number: number2,
      object,
      pathReference,
      relationship,
      select,
      slug,
      text: text2,
      url,
      ignored,
      mdx,
      markdoc
    });
  }
});

// ../keystatic.config.ts
var keystatic_config_default;
var init_keystatic_config = __esm({
  "../keystatic.config.ts"() {
    init_functionsRoutes_0_8824942990098752();
    init_keystatic_core_worker();
    keystatic_config_default = config({
      storage: {
        kind: "github",
        repo: {
          owner: "technicianofthesacred",
          name: "adrian-website"
        }
      },
      collections: {
        stories: collection({
          label: "Stories",
          slugField: "title",
          path: "content/stories/*",
          format: { contentField: "body" },
          schema: {
            title: index.slug({ name: { label: "Title" } }),
            subtitle: index.text({
              label: "Subtitle",
              validation: { isRequired: false }
            }),
            date: index.text({
              label: "Date",
              description: 'e.g. "Winter 2024" or "Spring 2025"'
            }),
            category: index.select({
              label: "Category",
              options: [
                { label: "Living Knowledge", value: "Living Knowledge" },
                { label: "Beneath the Surface", value: "Beneath the Surface" },
                { label: "The Practice", value: "The Practice" },
                { label: "The Path", value: "The Path" }
              ],
              defaultValue: "Living Knowledge"
            }),
            excerpt: index.text({
              label: "Excerpt",
              description: "Short preview shown on the writings listing page.",
              multiline: true
            }),
            image: index.text({
              label: "Cover image",
              description: 'Cloudinary public ID (e.g. "Ye-ming-zhu_sfkatw").',
              validation: { isRequired: false }
            }),
            readMinutes: index.number({
              label: "Read time (minutes)",
              validation: { isRequired: true, min: 1 }
            }),
            tags: index.array(
              index.text({ label: "Tag" }),
              { label: "Tags", itemLabel: /* @__PURE__ */ __name((props) => props.value ?? "Tag", "itemLabel") }
            ),
            isFeatured: index.checkbox({
              label: "Feature on home page",
              defaultValue: false
            }),
            order: index.number({
              label: "Sort order",
              description: "Lower numbers appear first in listings.",
              validation: { isRequired: false }
            }),
            relatedArtifactId: index.text({
              label: "Related artwork ID",
              validation: { isRequired: false }
            }),
            body: index.document({
              label: "Content",
              formatting: {
                inlineMarks: { bold: true, italic: true },
                blockTypes: { blockquote: true },
                headingLevels: [2, 3],
                listTypes: { unordered: true, ordered: true },
                softBreaks: true
              },
              links: true
            })
          }
        })
      }
    });
  }
});

// api/keystatic/[[params]].ts
var onRequest2;
var init_params = __esm({
  "api/keystatic/[[params]].ts"() {
    init_functionsRoutes_0_8824942990098752();
    init_keystatic_core_api_generic_worker();
    init_keystatic_config();
    onRequest2 = /* @__PURE__ */ __name(async (context) => {
      const handler = makeGenericAPIRouteHandler({
        config: keystatic_config_default,
        clientId: context.env.KEYSTATIC_GITHUB_CLIENT_ID,
        clientSecret: context.env.KEYSTATIC_GITHUB_CLIENT_SECRET,
        secret: context.env.KEYSTATIC_SECRET
      });
      const response = await handler(context.request);
      return new Response(response.body, response);
    }, "onRequest");
  }
});

// api/checkout.js
function isAllowedOrigin(origin, env) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (env?.STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
    try {
      const url2 = new URL(origin);
      return url2.hostname === "localhost" || url2.hostname === "127.0.0.1";
    } catch {
      return false;
    }
  }
  return false;
}
async function onRequestPost3(context) {
  const { request, env } = context;
  const requestOrigin = request.headers.get("origin") || "";
  const origin = isAllowedOrigin(requestOrigin, env) ? requestOrigin : ALLOWED_ORIGINS[0];
  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin
  };
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: corsHeaders
    });
  }
  if (!env.STRIPE_SECRET_KEY) {
    return new Response(JSON.stringify({ error: "Payment system is not configured. Please contact the studio." }), {
      status: 503,
      headers: corsHeaders
    });
  }
  const { items } = body;
  if (!Array.isArray(items) || items.length === 0) {
    return new Response(JSON.stringify({ error: "items must be a non-empty array" }), {
      status: 400,
      headers: corsHeaders
    });
  }
  if (items.length > MAX_ITEMS) {
    return new Response(JSON.stringify({ error: `Too many items. Maximum is ${MAX_ITEMS}.` }), {
      status: 400,
      headers: corsHeaders
    });
  }
  for (const item2 of items) {
    if (typeof item2.stripePriceId !== "string" || !item2.stripePriceId.startsWith("price_")) {
      return new Response(
        JSON.stringify({ error: "One or more items have an invalid price identifier." }),
        { status: 400, headers: corsHeaders }
      );
    }
    if (!Number.isInteger(item2.quantity) || item2.quantity < 1 || item2.quantity > MAX_QUANTITY_PER_ITEM) {
      return new Response(
        JSON.stringify({ error: `Quantity must be between 1 and ${MAX_QUANTITY_PER_ITEM}.` }),
        { status: 400, headers: corsHeaders }
      );
    }
  }
  const shippingParams = Object.fromEntries(
    SHIPPING_COUNTRIES.map((cc, i) => [
      `shipping_address_collection[allowed_countries][${i}]`,
      cc
    ])
  );
  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      mode: "payment",
      // Build line_items[N][price] and line_items[N][quantity]
      ...Object.fromEntries(
        items.flatMap((item2, i) => [
          [`line_items[${i}][price]`, item2.stripePriceId],
          [`line_items[${i}][quantity]`, String(item2.quantity)]
        ])
      ),
      // Collect shipping address for all orders (ships internationally from Bali)
      ...shippingParams,
      success_url: `${origin}/shop?checkout=success`,
      cancel_url: `${origin}/shop?checkout=cancelled`,
      // Allow promo codes
      allow_promotion_codes: "true"
    })
  });
  const session = await stripeRes.json();
  if (!stripeRes.ok || !session.url) {
    console.error("Stripe error:", JSON.stringify(session));
    return new Response(
      JSON.stringify({ error: "Payment session could not be created. Please try again or contact the studio." }),
      { status: 502, headers: corsHeaders }
    );
  }
  return new Response(JSON.stringify({ url: session.url }), {
    status: 200,
    headers: corsHeaders
  });
}
async function onRequestOptions(context) {
  const requestOrigin = context.request.headers.get("origin") || "";
  const origin = isAllowedOrigin(requestOrigin, context.env) ? requestOrigin : ALLOWED_ORIGINS[0];
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
var SHIPPING_COUNTRIES, ALLOWED_ORIGINS, MAX_ITEMS, MAX_QUANTITY_PER_ITEM;
var init_checkout = __esm({
  "api/checkout.js"() {
    init_functionsRoutes_0_8824942990098752();
    SHIPPING_COUNTRIES = [
      "US",
      "CA",
      "GB",
      "AU",
      "NZ",
      "SG",
      "MY",
      "ID",
      "TH",
      "PH",
      "JP",
      "KR",
      "HK",
      "TW",
      "DE",
      "FR",
      "NL",
      "BE",
      "CH",
      "AT",
      "IT",
      "ES",
      "PT",
      "SE",
      "NO",
      "DK",
      "FI",
      "AE",
      "IL",
      "ZA",
      "IN",
      "BR",
      "MX",
      "AR"
    ];
    ALLOWED_ORIGINS = [
      "https://adrianrasmussen.com",
      "https://www.adrianrasmussen.com",
      "https://adrian-rasmussen-art.pages.dev"
    ];
    __name(isAllowedOrigin, "isAllowedOrigin");
    MAX_ITEMS = 20;
    MAX_QUANTITY_PER_ITEM = 10;
    __name(onRequestPost3, "onRequestPost");
    __name(onRequestOptions, "onRequestOptions");
  }
});

// api/delete-file.js
function getCookie2(request, name) {
  const header = request.headers.get("Cookie") || "";
  const match2 = header.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return match2 ? match2.slice(name.length + 1) : null;
}
async function onRequestDelete({ request, env }) {
  if (getCookie2(request, COOKIE_NAME4) !== env.UPLOAD_SECRET) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const key = new URL(request.url).searchParams.get("key");
  if (!key) {
    return new Response(JSON.stringify({ ok: false, error: "Missing key" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  await env.MUSIC_BUCKET.delete(key);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
var COOKIE_NAME4;
var init_delete_file = __esm({
  "api/delete-file.js"() {
    init_functionsRoutes_0_8824942990098752();
    COOKIE_NAME4 = "admin_session";
    __name(getCookie2, "getCookie");
    __name(onRequestDelete, "onRequestDelete");
  }
});

// api/inquire.js
function isAllowedOrigin2(origin, env) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS2.includes(origin)) return true;
  if (env?.RESEND_API_KEY?.startsWith("re_test_") || !env?.RESEND_API_KEY) {
    try {
      const url2 = new URL(origin);
      return url2.hostname === "localhost" || url2.hostname === "127.0.0.1";
    } catch {
      return false;
    }
  }
  return false;
}
function escapeHtml2(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function buildEmailHtml(data) {
  const {
    name,
    email,
    commissionType,
    vision,
    budget,
    timeline,
    referral,
    inquiryType,
    pieceTitle,
    purchaseSize,
    purchaseAddOns,
    purchaseAvailability,
    purchasePrice
  } = data;
  const isPurchase = inquiryType === "purchase";
  if (isPurchase) {
    const rows2 = [
      ["Name", name],
      ["Email", email],
      ["Piece", pieceTitle || "\u2014"]
    ];
    if (purchaseSize) rows2.push(["Size", purchaseSize]);
    if (purchaseAddOns && purchaseAddOns.length) rows2.push(["Add-ons", purchaseAddOns.join(", ")]);
    if (purchaseAvailability) rows2.push(["Availability", purchaseAvailability]);
    if (purchasePrice) rows2.push(["Price", purchasePrice]);
    const tableRows2 = rows2.map(
      ([label, value]) => `<tr><td style="padding:8px 12px;font-weight:600;color:#5c4a3a;white-space:nowrap;vertical-align:top">${escapeHtml2(label)}</td><td style="padding:8px 12px;color:#3d3024">${escapeHtml2(value)}</td></tr>`
    ).join("");
    return `
<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#3d3024">
  <h2 style="font-size:22px;font-weight:400;margin-bottom:24px">New Purchase Request</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    ${tableRows2}
  </table>
  ${vision ? `<div style="border-top:1px solid #d4c8b8;padding-top:20px">
    <h3 style="font-size:14px;text-transform:uppercase;letter-spacing:0.15em;color:#5c4a3a;margin-bottom:12px">Notes</h3>
    <p style="line-height:1.7;white-space:pre-wrap">${escapeHtml2(vision)}</p>
  </div>` : ""}
</div>`.trim();
  }
  const rows = [
    ["Name", name],
    ["Email", email],
    ["Commission Type", commissionType]
  ];
  if (budget) rows.push(["Budget", budget]);
  if (timeline) rows.push(["Timeline", timeline]);
  if (referral) rows.push(["How they found you", referral]);
  const tableRows = rows.map(
    ([label, value]) => `<tr><td style="padding:8px 12px;font-weight:600;color:#5c4a3a;white-space:nowrap;vertical-align:top">${escapeHtml2(label)}</td><td style="padding:8px 12px;color:#3d3024">${escapeHtml2(value)}</td></tr>`
  ).join("");
  return `
<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#3d3024">
  <h2 style="font-size:22px;font-weight:400;margin-bottom:24px">New Commission Inquiry</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    ${tableRows}
  </table>
  <div style="border-top:1px solid #d4c8b8;padding-top:20px">
    <h3 style="font-size:14px;text-transform:uppercase;letter-spacing:0.15em;color:#5c4a3a;margin-bottom:12px">What wants to exist</h3>
    <p style="line-height:1.7;white-space:pre-wrap">${escapeHtml2(vision)}</p>
  </div>
</div>`.trim();
}
async function onRequestPost4(context) {
  const { request, env } = context;
  const requestOrigin = request.headers.get("origin") || "";
  const origin = isAllowedOrigin2(requestOrigin, env) ? requestOrigin : ALLOWED_ORIGINS2[0];
  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin
  };
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: corsHeaders
    });
  }
  if (!env.RESEND_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Email service is not configured. Please contact the studio directly." }),
      { status: 503, headers: corsHeaders }
    );
  }
  const { name, email, vision, commissionType, inquiryType } = body;
  const isPurchase = inquiryType === "purchase";
  if (!name || !email || !isPurchase && (!vision || !commissionType)) {
    return new Response(
      JSON.stringify({ error: "Please fill in all required fields." }),
      { status: 400, headers: corsHeaders }
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(
      JSON.stringify({ error: "Please provide a valid email address." }),
      { status: 400, headers: corsHeaders }
    );
  }
  const toEmail = env.INQUIRY_TO_EMAIL || DEFAULT_TO;
  const fromEmail = env.RESEND_FROM_EMAIL || DEFAULT_FROM;
  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: `Adrian Rasmussen Art <${fromEmail}>`,
      to: [toEmail],
      reply_to: email,
      subject: isPurchase ? `Purchase Request from ${name} \u2014 ${body.pieceTitle || "Piece"}` : `Commission Inquiry from ${name} (${commissionType})`,
      html: buildEmailHtml(body)
    })
  });
  if (!resendRes.ok) {
    const err = await resendRes.json().catch(() => ({}));
    console.error("Resend error:", JSON.stringify(err));
    return new Response(
      JSON.stringify({ error: "Your message could not be sent. Please try again or contact the studio directly." }),
      { status: 502, headers: corsHeaders }
    );
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: corsHeaders
  });
}
async function onRequestOptions2(context) {
  const requestOrigin = context.request.headers.get("origin") || "";
  const origin = isAllowedOrigin2(requestOrigin, context.env) ? requestOrigin : ALLOWED_ORIGINS2[0];
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
var ALLOWED_ORIGINS2, DEFAULT_TO, DEFAULT_FROM;
var init_inquire = __esm({
  "api/inquire.js"() {
    init_functionsRoutes_0_8824942990098752();
    ALLOWED_ORIGINS2 = [
      "https://adrianrasmussen.com",
      "https://www.adrianrasmussen.com",
      "https://adrian-rasmussen-art.pages.dev"
    ];
    __name(isAllowedOrigin2, "isAllowedOrigin");
    DEFAULT_TO = "technicianofthesacred@gmail.com";
    DEFAULT_FROM = "noreply@adrianrasmussen.com";
    __name(escapeHtml2, "escapeHtml");
    __name(buildEmailHtml, "buildEmailHtml");
    __name(onRequestPost4, "onRequestPost");
    __name(onRequestOptions2, "onRequestOptions");
  }
});

// api/subscribe.js
function isAllowedOrigin3(origin, env) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS3.includes(origin)) return true;
  if (!env?.KIT_PUBLIC_API_KEY) {
    try {
      const url2 = new URL(origin);
      return url2.hostname === "localhost" || url2.hostname === "127.0.0.1";
    } catch {
      return false;
    }
  }
  try {
    const url2 = new URL(origin);
    if (url2.hostname === "localhost" || url2.hostname === "127.0.0.1") return true;
  } catch {
  }
  return false;
}
async function onRequestPost5(context) {
  const { request, env } = context;
  const requestOrigin = request.headers.get("origin") || "";
  const origin = isAllowedOrigin3(requestOrigin, env) ? requestOrigin : ALLOWED_ORIGINS3[0];
  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin
  };
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: corsHeaders
    });
  }
  const formId = env.KIT_FORM_ID;
  const apiKey = env.KIT_PUBLIC_API_KEY;
  if (!formId || !apiKey) {
    return new Response(
      JSON.stringify({ error: "Newsletter service is not configured." }),
      { status: 503, headers: corsHeaders }
    );
  }
  const { email } = body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(
      JSON.stringify({ error: "Please provide a valid email address." }),
      { status: 400, headers: corsHeaders }
    );
  }
  const kitRes = await fetch(
    `https://api.convertkit.com/v3/forms/${formId}/subscribe`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ api_key: apiKey, email })
    }
  );
  const data = await kitRes.json().catch(() => ({}));
  if (!kitRes.ok || !data.subscription) {
    console.error("Kit error:", JSON.stringify(data));
    return new Response(
      JSON.stringify({ error: "Subscription failed. Please try again." }),
      { status: 502, headers: corsHeaders }
    );
  }
  return new Response(JSON.stringify({ subscription: data.subscription }), {
    status: 200,
    headers: corsHeaders
  });
}
async function onRequestOptions3(context) {
  const requestOrigin = context.request.headers.get("origin") || "";
  const origin = isAllowedOrigin3(requestOrigin, context.env) ? requestOrigin : ALLOWED_ORIGINS3[0];
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
var ALLOWED_ORIGINS3;
var init_subscribe = __esm({
  "api/subscribe.js"() {
    init_functionsRoutes_0_8824942990098752();
    ALLOWED_ORIGINS3 = [
      "https://adrianrasmussen.com",
      "https://www.adrianrasmussen.com",
      "https://adrian-rasmussen-art.pages.dev"
    ];
    __name(isAllowedOrigin3, "isAllowedOrigin");
    __name(onRequestPost5, "onRequestPost");
    __name(onRequestOptions3, "onRequestOptions");
  }
});

// api/upload-music.js
function getCookie3(request, name) {
  const header = request.headers.get("Cookie") || "";
  const match2 = header.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return match2 ? match2.slice(name.length + 1) : null;
}
function isAuthed(request, env) {
  return getCookie3(request, COOKIE_NAME5) === env.UPLOAD_SECRET;
}
async function onRequestPost6({ request, env }) {
  if (!isAuthed(request, env)) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid form data" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const file2 = formData.get("file");
  const filename = formData.get("filename");
  if (!file2 || !filename) {
    return new Response(JSON.stringify({ ok: false, error: "Missing file or filename" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const safeFilename = filename.toString().replace(/[^a-z0-9._-]/gi, "-").toLowerCase();
  const buffer = await file2.arrayBuffer();
  await env.MUSIC_BUCKET.put(safeFilename, buffer, {
    httpMetadata: { contentType: file2.type || "audio/mpeg" }
  });
  const url2 = `${PUBLIC_BASE}/${safeFilename}`;
  return new Response(JSON.stringify({ ok: true, url: url2 }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
async function onRequestGet2({ request, env }) {
  if (!isAuthed(request, env)) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const listed = await env.MUSIC_BUCKET.list();
  const files = listed.objects.map((obj) => ({
    key: obj.key,
    url: `${PUBLIC_BASE}/${obj.key}`,
    size: obj.size,
    uploaded: obj.uploaded
  }));
  return new Response(JSON.stringify({ ok: true, files }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
var PUBLIC_BASE, COOKIE_NAME5;
var init_upload_music = __esm({
  "api/upload-music.js"() {
    init_functionsRoutes_0_8824942990098752();
    PUBLIC_BASE = "https://pub-c319a4177bc349d7879bd19145ffa2cb.r2.dev";
    COOKIE_NAME5 = "admin_session";
    __name(getCookie3, "getCookie");
    __name(isAuthed, "isAuthed");
    __name(onRequestPost6, "onRequestPost");
    __name(onRequestGet2, "onRequestGet");
  }
});

// qr/oracle.js
function onRequest3() {
  return Response.redirect(
    "https://adrianrasmussen.com/oracle?ref=qr",
    302
  );
}
var init_oracle = __esm({
  "qr/oracle.js"() {
    init_functionsRoutes_0_8824942990098752();
    __name(onRequest3, "onRequest");
  }
});

// qr/[number].js
function onRequest4({ params }) {
  if (params.number === "oracle") {
    return Response.redirect(
      "https://adrianrasmussen.com/oracle?ref=qr",
      302
    );
  }
  const n = parseInt(params.number, 10);
  if (isNaN(n) || n < 1 || n > 64) {
    return new Response("Not found", { status: 404 });
  }
  return Response.redirect(
    `https://adrianrasmussen.com/oracle/universal-language/${n}?ref=qr`,
    302
  );
}
var init_number2 = __esm({
  "qr/[number].js"() {
    init_functionsRoutes_0_8824942990098752();
    __name(onRequest4, "onRequest");
  }
});

// ../.wrangler/tmp/pages-NyD707/functionsRoutes-0.8824942990098752.mjs
var routes;
var init_functionsRoutes_0_8824942990098752 = __esm({
  "../.wrangler/tmp/pages-NyD707/functionsRoutes-0.8824942990098752.mjs"() {
    init_login();
    init_logout();
    init_verify();
    init_number();
    init_params();
    init_checkout();
    init_checkout();
    init_delete_file();
    init_inquire();
    init_inquire();
    init_subscribe();
    init_subscribe();
    init_upload_music();
    init_upload_music();
    init_oracle();
    init_number2();
    routes = [
      {
        routePath: "/api/admin/login",
        mountPath: "/api/admin",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost]
      },
      {
        routePath: "/api/admin/logout",
        mountPath: "/api/admin",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost2]
      },
      {
        routePath: "/api/admin/verify",
        mountPath: "/api/admin",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet]
      },
      {
        routePath: "/oracle/universal-language/:number",
        mountPath: "/oracle/universal-language",
        method: "",
        middlewares: [],
        modules: [onRequest]
      },
      {
        routePath: "/api/keystatic/:params*",
        mountPath: "/api/keystatic",
        method: "",
        middlewares: [],
        modules: [onRequest2]
      },
      {
        routePath: "/api/checkout",
        mountPath: "/api",
        method: "OPTIONS",
        middlewares: [],
        modules: [onRequestOptions]
      },
      {
        routePath: "/api/checkout",
        mountPath: "/api",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost3]
      },
      {
        routePath: "/api/delete-file",
        mountPath: "/api",
        method: "DELETE",
        middlewares: [],
        modules: [onRequestDelete]
      },
      {
        routePath: "/api/inquire",
        mountPath: "/api",
        method: "OPTIONS",
        middlewares: [],
        modules: [onRequestOptions2]
      },
      {
        routePath: "/api/inquire",
        mountPath: "/api",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost4]
      },
      {
        routePath: "/api/subscribe",
        mountPath: "/api",
        method: "OPTIONS",
        middlewares: [],
        modules: [onRequestOptions3]
      },
      {
        routePath: "/api/subscribe",
        mountPath: "/api",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost5]
      },
      {
        routePath: "/api/upload-music",
        mountPath: "/api",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet2]
      },
      {
        routePath: "/api/upload-music",
        mountPath: "/api",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost6]
      },
      {
        routePath: "/qr/oracle",
        mountPath: "/qr",
        method: "",
        middlewares: [],
        modules: [onRequest3]
      },
      {
        routePath: "/qr/:number",
        mountPath: "/qr",
        method: "",
        middlewares: [],
        modules: [onRequest4]
      }
    ];
  }
});

// ../.wrangler/tmp/bundle-kRKxeF/middleware-loader.entry.ts
init_functionsRoutes_0_8824942990098752();

// ../.wrangler/tmp/bundle-kRKxeF/middleware-insertion-facade.js
init_functionsRoutes_0_8824942990098752();

// ../../../../../../.nvm/versions/node/v22.20.0/lib/node_modules/wrangler/templates/pages-template-worker.ts
init_functionsRoutes_0_8824942990098752();

// ../../../../../../.nvm/versions/node/v22.20.0/lib/node_modules/wrangler/node_modules/path-to-regexp/dist.es2015/index.js
init_functionsRoutes_0_8824942990098752();
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code2 = str.charCodeAt(j);
        if (
          // `0-9`
          code2 >= 48 && code2 <= 57 || // `A-Z`
          code2 >= 65 && code2 <= 90 || // `a-z`
          code2 >= 97 && code2 <= 122 || // `_`
          code2 === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse2(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type2) {
    if (i < tokens.length && tokens[i].type === type2)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type2) {
    var value2 = tryConsume(type2);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index2 = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index2, ", expected ").concat(type2));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse2, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index2 = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index: index2, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index2 = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index2++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse2(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../../../../.nvm/versions/node/v22.20.0/lib/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url2 = input;
        if (typeof input === "string") {
          url2 = new URL(input, request.url).toString();
        }
        request = new Request(url2, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error2) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error2;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");

// ../../../../../../.nvm/versions/node/v22.20.0/lib/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
init_functionsRoutes_0_8824942990098752();
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../../../.nvm/versions/node/v22.20.0/lib/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
init_functionsRoutes_0_8824942990098752();
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error2 = reduceError(e);
    return Response.json(error2, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// ../.wrangler/tmp/bundle-kRKxeF/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;

// ../../../../../../.nvm/versions/node/v22.20.0/lib/node_modules/wrangler/templates/middleware/common.ts
init_functionsRoutes_0_8824942990098752();
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// ../.wrangler/tmp/bundle-kRKxeF/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type2, init) {
        if (type2 === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type2, init) => {
      if (type2 === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
/*! Bundled license information:

react/cjs/react.development.js:
  (**
   * @license React
   * react.development.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react/cjs/react-jsx-runtime.development.js:
  (**
   * @license React
   * react-jsx-runtime.development.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)
*/
//# sourceMappingURL=functionsWorker-0.6354836301528453.mjs.map
