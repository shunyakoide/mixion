import QRCode from 'qrcode'

/**
 * QR module grid for `text`. `true` = black. Row-major, [row][col].
 * Works in Node and the browser (no canvas involved).
 */
export function qrModules(text: string, errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H' = 'M'): boolean[][] {
  const code = QRCode.create(text, { errorCorrectionLevel })
  const { size, data } = code.modules
  const grid: boolean[][] = []
  for (let r = 0; r < size; r++) {
    const row: boolean[] = []
    for (let c = 0; c < size; c++) row.push(data[r * size + c] === 1)
    grid.push(row)
  }
  return grid
}
