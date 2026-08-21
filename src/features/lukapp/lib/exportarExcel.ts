import type { Instantanea } from '../data/repositorio';
import { ES_PASIVO } from '../data/modelos';

/**
 * Genera un archivo Excel (.xls XML Spreadsheet) formateado con hojas, estilos,
 * colores y formatos numéricos que abre de forma nativa en Microsoft Excel,
 * LibreOffice Calc y Google Sheets sin requerir librerías pesadas externas.
 */
export const generarExcelFinanciero = (
  datos: Instantanea,
  cajitasBalances: Record<string, number>,
  mesFiltro?: string,
): string => {
  const nombreCuenta = (id: string | null) =>
    id ? (datos.cajitas.find((c) => c.id === id)?.nombre ?? 'Sin cuenta') : 'Sin cuenta';

  const txs = mesFiltro
    ? datos.transacciones.filter((t) => t.occurredOn.startsWith(mesFiltro))
    : datos.transacciones;

  const ordenadas = [...txs].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));

  // XML Spreadsheet 2003 format (standard Microsoft Excel XML)
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D4D4D8"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#18181B" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="HeaderGreen">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#16A34A" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="HeaderRed">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#DC2626" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Money">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="$#,##0"/>
  </Style>
  <Style ss:ID="MoneyIngreso">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#16A34A" ss:Bold="1"/>
   <NumberFormat ss:Format="$#,##0"/>
  </Style>
  <Style ss:ID="MoneyGasto">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#DC2626"/>
   <NumberFormat ss:Format="$#,##0"/>
  </Style>
  <Style ss:ID="Center">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Bold">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Bold="1"/>
  </Style>
 </Styles>

 <!-- HOJA 1: MOVIMIENTOS -->
 <Worksheet ss:Name="Movimientos">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="90"/>
   <Column ss:Width="80"/>
   <Column ss:Width="100"/>
   <Column ss:Width="110"/>
   <Column ss:Width="220"/>
   <Column ss:Width="130"/>
   <Row ss:Height="24">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Fecha</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Tipo</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Monto (COP)</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Categoría</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Descripción</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Cuenta</Data></Cell>
   </Row>
   ${ordenadas
     .map(
       (tx) => `
   <Row>
    <Cell ss:StyleID="Center"><Data ss:Type="String">${tx.occurredOn}</Data></Cell>
    <Cell ss:StyleID="Center"><Data ss:Type="String">${tx.kind === 'ingreso' ? 'Ingreso' : 'Gasto'}</Data></Cell>
    <Cell ss:StyleID="${tx.kind === 'ingreso' ? 'MoneyIngreso' : 'MoneyGasto'}"><Data ss:Type="Number">${tx.amountCop}</Data></Cell>
    <Cell><Data ss:Type="String">${escaparXml(tx.category)}</Data></Cell>
    <Cell><Data ss:Type="String">${escaparXml(tx.description || tx.rawTranscript)}</Data></Cell>
    <Cell><Data ss:Type="String">${escaparXml(nombreCuenta(tx.cuentaId))}</Data></Cell>
   </Row>`,
     )
     .join('')}
  </Table>
 </Worksheet>

 <!-- HOJA 2: CUENTAS Y SALDOS -->
 <Worksheet ss:Name="Cuentas y Saldos">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="180"/>
   <Column ss:Width="110"/>
   <Column ss:Width="130"/>
   <Row ss:Height="24">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Cuenta / Cajita</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Tipo</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Saldo Actual (COP)</Data></Cell>
   </Row>
   ${datos.cajitas
     .filter((c) => !c.archivedAt)
     .map((c) => {
       const saldo = cajitasBalances[c.id] ?? 0;
       const esPasivo = ES_PASIVO[c.tipo];
       return `
   <Row>
    <Cell ss:StyleID="Bold"><Data ss:Type="String">${escaparXml(c.nombre)}</Data></Cell>
    <Cell ss:StyleID="Center"><Data ss:Type="String">${c.tipo}</Data></Cell>
    <Cell ss:StyleID="${esPasivo ? 'MoneyGasto' : 'Money'}"><Data ss:Type="Number">${saldo}</Data></Cell>
   </Row>`;
     })
     .join('')}
  </Table>
 </Worksheet>
</Workbook>`;
};

const escaparXml = (texto: string): string =>
  texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export const descargarExcel = (
  datos: Instantanea,
  cajitasBalances: Record<string, number>,
  mesFiltro?: string,
) => {
  const xml = generarExcelFinanciero(datos, cajitasBalances, mesFiltro);
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = mesFiltro ? `finanzas-${mesFiltro}.xls` : `finanzas-completo.xls`;
  a.click();
  URL.revokeObjectURL(url);
};
