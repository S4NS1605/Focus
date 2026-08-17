const diasSemana = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const mesesDelAño = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11 };

function extractDate(tokens: {norm: string}[], today: Date): {dateStr: string, consumedIdx: number[]} | null {
    // 1. "hace X dias"
    // 2. "el [lunes|martes...] pasado"
    // 3. "el [numero] de [mes]"
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].norm === 'hace' && i + 2 < tokens.length && (tokens[i+2].norm === 'dias' || tokens[i+2].norm === 'dia')) {
            const num = parseInt(tokens[i+1].norm, 10);
            if (!isNaN(num)) {
                const d = new Date(today);
                d.setDate(d.getDate() - num);
                return { dateStr: d.toISOString().split('T')[0], consumedIdx: [i, i+1, i+2] };
            }
        }
        
        if (tokens[i].norm === 'el' && i + 2 < tokens.length && tokens[i+2].norm === 'pasado') {
            const diaStr = tokens[i+1].norm;
            if (diaStr in diasSemana) {
                const targetDay = diasSemana[diaStr as keyof typeof diasSemana];
                let d = new Date(today);
                d.setDate(d.getDate() - 1); // Empezamos a buscar desde ayer
                while (d.getDay() !== targetDay) {
                    d.setDate(d.getDate() - 1);
                }
                return { dateStr: d.toISOString().split('T')[0], consumedIdx: [i, i+1, i+2] };
            }
        }
        
        if (tokens[i].norm === 'el' && i + 3 < tokens.length && tokens[i+2].norm === 'de') {
            const diaNum = parseInt(tokens[i+1].norm, 10);
            const mesStr = tokens[i+3].norm;
            if (!isNaN(diaNum) && diaNum >= 1 && diaNum <= 31 && mesStr in mesesDelAño) {
                const mesNum = mesesDelAño[mesStr as keyof typeof mesesDelAño];
                let d = new Date(today.getFullYear(), mesNum, diaNum);
                // Si la fecha es en el futuro, probablemente fue del año pasado
                if (d > today) d.setFullYear(d.getFullYear() - 1);
                return { dateStr: d.toISOString().split('T')[0], consumedIdx: [i, i+1, i+2, i+3] };
            }
        }
    }
    return null;
}

const today = new Date('2026-08-16'); // Today
console.log(extractDate([{norm: 'hace'}, {norm: '3'}, {norm: 'dias'}], today));
console.log(extractDate([{norm: 'el'}, {norm: 'viernes'}, {norm: 'pasado'}], today));
console.log(extractDate([{norm: 'el'}, {norm: '15'}, {norm: 'de'}, {norm: 'agosto'}], today));
