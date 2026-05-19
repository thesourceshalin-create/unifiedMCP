import ExcelJS from 'exceljs'

const wb = new ExcelJS.Workbook()
const ws = wb.addWorksheet('Sales')
ws.columns = [
  { header: 'Name', key: 'name' },
  { header: 'Revenue', key: 'revenue' },
  { header: 'Active', key: 'active' },
]
ws.addRow({ name: 'Alice', revenue: 1200, active: true })
ws.addRow({ name: 'Bob', revenue: 800, active: false })
ws.addRow({ name: 'Carol', revenue: 1500, active: true })

const ws2 = wb.addWorksheet('Inventory')
ws2.columns = [{ header: 'Item', key: 'item' }, { header: 'Stock', key: 'stock' }]
ws2.addRow({ item: 'Widget', stock: 50 })

await wb.xlsx.writeFile('fixtures/test.xlsx')
console.log('Created fixtures/test.xlsx')
