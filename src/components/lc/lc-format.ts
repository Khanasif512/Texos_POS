/** Display helpers for LC screens (display only — all money math happens on the server). */

const rateFmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 6 })
const fourDp = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 4 })
const foreignFmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 4 })
const weightFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 4 })
const pctFmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const rate = (v: number) => rateFmt.format(v)
/** BDT with up to 4 decimals (per-unit costs). */
export const unitMoney = (v: number) => `৳ ${fourDp.format(v)}`
export const foreign = (v: number, currency: string) => `${currency} ${foreignFmt.format(v)}`
export const kg = (v: number) => `${weightFmt.format(v)} kg`
export const percent = (ratio: number) => `${pctFmt.format(ratio * 100)}%`
