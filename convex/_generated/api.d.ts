/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as acceso from "../acceso.js";
import type * as auth from "../auth.js";
import type * as clientes from "../clientes.js";
import type * as equipo from "../equipo.js";
import type * as helpers from "../helpers.js";
import type * as http from "../http.js";
import type * as interacciones from "../interacciones.js";
import type * as recuperar from "../recuperar.js";
import type * as seguimientos from "../seguimientos.js";
import type * as users from "../users.js";
import type * as ventas from "../ventas.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  acceso: typeof acceso;
  auth: typeof auth;
  clientes: typeof clientes;
  equipo: typeof equipo;
  helpers: typeof helpers;
  http: typeof http;
  interacciones: typeof interacciones;
  recuperar: typeof recuperar;
  seguimientos: typeof seguimientos;
  users: typeof users;
  ventas: typeof ventas;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
