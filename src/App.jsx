// Core React hooks used throughout the app.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import countries110m from 'world-atlas/countries-110m.json';
import {
  buildClusteredNodes,
  buildDefaultMapView,
  buildVisibleLabelIds,
  parseQuadraticPath,
  pointToQuadraticDistance,
} from './mapLayoutHelpers';


// ============================================================
// SAMPLE DATA
// ============================================================
// These embedded tables let the app work immediately, even before the
// user uploads anything. They are intentionally kept in this file so the
// whole prototype remains portable in one pasteable source file.
//
// Future cleanup option:
// move these three constants into a separate helper file once the project
// becomes stable enough to support multi-file editing.
//
// Embedded fallback geography CSV used before the user uploads files.
const SAMPLE_GEOGRAPHY_CSV = `Date	Source_Loc	Source_Lat	Source_Long	Source	Target	Target_Inferred_Loc	Target_Lat	Target_Long
0000/00/00	Firenze/Fiorenza	43.77382166	11.25553626	"von Habsburg, Maria Magdalena"	"d'Elci, Orso"	Firenze/Fiorenza	43.77382166	11.25553626
0000/00/00	Fivizzano	44.23870397	10.12493307	Various	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
0000/00/00	Illegible	 -   	 -   	Illegible	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
0000/00/00	Livorno	43.548473	43.548473	Various	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
0000/00/00	Lunigiano	44.29531395	9.95084605	"Gualtinii, Girolamo"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
0000/00/00	Siena	43.31847685	11.33107927	Colomba	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
0000/00/00	Siena	43.31847685	11.33107927	Colomba	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
0000/00/00	Unknown	 -   	 -   	"de' Medici, Carlo"	"de' Medici, Giovanni"	Fuligno	42.95097088	12.70117267
0000/00/00	Unknown	 -   	 -   	"de' Medici, Carlo"	"di Lorena, Cristina"	Firenze/Fiorenza	43.77382166	11.25553626
0000/00/00	Unknown	 -   	 -   	"de' Medici, Carlo"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1608/10/14	Bologna	44.49363052	11.3385396	Unnamed	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1608/10/15	Posonii	0	0	Illegible	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1608/10/16	Parma	44.801472	10.328	"Farnese, Ranuccio"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1608/10/17	Parma	44.801472	10.328	"Aldobrandini, Margherita"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1608/10/17	Roma	41.89962958	12.56787728	"Barberini, ?"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1608/10/31	Roma	41.89962958	12.56787728	"Bandini, ?"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1609/02/23	Roma	41.89962958	12.56787728	"Bellarmino, ?"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1609/02/23	Roma	41.89962958	12.56787728	"Barberini, ?"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1609/02/25	Milano/Mediolani	45.46900381	9.17219094	"Solari, Gio. Battista"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1609/02/26	Roma	41.89962958	12.56787728	0	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1609/03/03	Genova	44.40988493	8.93649255	"C__, Carlo"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1609/03/05	Illegible	 -   	 -   	0	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1609/03/15	Parma	44.801472	10.328	"Farnese, Ranuccio"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1609/03/17	Parma	44.801472	10.328	"Aldobrandini, Margherita"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1609/03/18	Milano/Mediolani	45.46900381	9.17219094	"Solari, Gio. Battista"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1609/03/28	Roma	41.89962958	12.56787728	0	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1609/06/22	Siena	43.31847685	11.33107927	"Pinocci, Turno"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1609/07/01	Milano/Mediolani	45.46900381	9.17219094	"Solari, Gio. Battista"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1609/07/08	Milano/Mediolani	45.46900381	9.17219094	"Solari, Gio. Battista"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1609/07/10	Torino	45.06702666	7.68630787	0	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1609/07/15	Casteldurante	43.7148786	12.62039634	Livia	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1609/07/15	Casteldurante	43.7148786	12.62039634	Unnamed	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1609/07/18	Modena	44.64712815	10.92377971	0	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1609/07/22	Milano/Mediolani	45.46900381	9.17219094	"Solari, Gio. Battista"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1609/08/26	Milano/Mediolani	45.46900381	9.17219094	"Solari, Gio. Battista"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1609/12/19	Roma	41.89962958	12.56787728	0	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1609/12/19	Ravena	0	0	"Caetano, ?"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1609/12/19	Roma	41.89962958	12.56787728	"Sannesini___, ?"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1609/12/19	Roma	41.89962958	12.56787728	"Bandini, ?"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1609/12/20	Casteldurante	43.7148786	12.62039634	Unnamed	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1610/02/10	Firenze/Fiorenza	43.77382166	11.25553626	"von Habsburg, Maria Magdalena"	"d'Elci, Orso"	Firenze/Fiorenza	43.77382166	11.25553626
1610/10/09	Firenze/Fiorenza	43.77382166	11.25553626	"von Habsburg, Maria Magdalena"	"d'Elci, Orso"	Firenze/Fiorenza	43.77382166	11.25553626
1610/11/20	Roma	41.89962958	12.56787728	"?, Gon.a"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1610/11/20	Venetia	45.43735562	12.34869162	"Turriani, Horatio"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1610/11/24	Milano/Mediolani	45.46900381	9.17219094	"Solari, Gio. Battista"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1610/11/27	Venetia	45.43735562	12.34869162	"Turriani, Horatio"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1610/11/27	Roma	41.89962958	12.56787728	"Borromeo, ?"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1610/12/01	Firenze/Fiorenza	43.77382166	11.25553626	"von Habsburg, Maria Magdalena"	"d'Elci, Orso"	Firenze/Fiorenza	43.77382166	11.25553626
1610/12/20	Ferrara	0	0	Pio	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1611/02/23	Milano/Mediolani	45.46900381	9.17219094	"Solari, Gio. Battista"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1611/03/00	Mantova	45.15643725	10.79144368	"Gonzaga, ?"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1611/03/04	Roma	41.89962958	12.56787728	"dal Monte, ?"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1611/03/05	Siena	43.31847685	11.33107927	Multiple	"de' Medici, Cosimo II"	Firenze/Fiorenza	43.77382166	11.25553626
1611/07/22	Firenze/Fiorenza	43.77382166	11.25553626	"von Habsburg, Maria Magdalena"	"d'Elci, Orso"	Firenze/Fiorenza	43.77382166	11.25553626
1611/11/05	Venetia	45.43735562	12.34869162	"Turriani, Horatio"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1611/11/06	Siena	43.31847685	11.33107927	"von Habsburg, Maria Magdalena"	"d'Elci, Orso"	Firenze/Fiorenza	43.77382166	11.25553626
1611/12/22	Siena	43.31847685	11.33107927	"Borghesi, Calidonia"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1612/03/03	Venegia	45.43735562	12.34869162	"Turriani, Horatio"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1612/03/07	Milano/Mediolani	45.46900381	9.17219094	"Solari, Gio. Battista"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1612/03/08	Firenze/Fiorenza	43.77382166	11.25553626	"de' Medici, Ferdinando II"	"de' Medici, Cosimo II"	Firenze/Fiorenza	43.77382166	11.25553626
1612/03/10	Venegia	45.43735562	12.34869162	"Turriani, Horatio"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1612/03/14	Milano/Mediolani	45.46900381	9.17219094	"Solari, Gio. Battista"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1612/03/17	Venetia	45.43735562	12.34869162	"Turriani, Horatio"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1612/06/13	Milano/Mediolani	45.46900381	9.17219094	"Turriani, Horatio"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1612/06/18	Casteldurante	43.7148786	12.62039634	Unnamed	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1612/08/01	Milano/Mediolani	45.46900381	9.17219094	"Solari, Gio. Battista"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1612/08/07	Firenze/Fiorenza	43.77382166	11.25553626	"von Habsburg, Maria Magdalena"	"d'Elci, Orso"	Firenze/Fiorenza	43.77382166	11.25553626
1613/05/22	Milano/Mediolani	45.46900381	9.17219094	"Solari, Gio. Battista"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1613/06/12	Milano/Mediolani	45.46900381	9.17219094	"Solari, Gio. Battista"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1613/08/16	Firenze/Fiorenza	43.77382166	11.25553626	"von Habsburg, Maria Magdalena"	"d'Elci, Orso"	Firenze/Fiorenza	43.77382166	11.25553626
1613/08/18	Siena	43.31847685	11.33107927	"Gug.mi, Gio. Batta"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1613/10/11	Cortona	43.27483703	11.98570934	"von Habsburg, Maria Magdalena"	"de' Medici, Cosimo II"	Firenze/Fiorenza	43.77382166	11.25553626
1613/10/11	Perugia	43.1049308	12.38700025	Multiple	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1613/10/13	Perugia	43.1049308	12.38700025	"von Habsburg, Maria Magdalena"	"de' Medici, Cosimo II"	Firenze/Fiorenza	43.77382166	11.25553626
1613/10/17	Camerino	43.13783636	13.07291292	"de' Medici, Giovanni"	"de' Medici, Cosimo II"	Firenze/Fiorenza	43.77382166	11.25553626
1613/10/17	Casteldurante	43.7148786	12.62039634	Unnamed	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1613/10/18	Macerata	43.29936117	13.44809724	"de' Medici, Giovanni"	"de' Medici, Cosimo II"	Firenze/Fiorenza	43.77382166	11.25553626
1613/10/18	Tolentino	43.20869199	13.28385411	"de' Medici, Giovanni"	Unknown	Unknown	0	0
1613/10/19	Maccerati(?)	43.29936117	13.44809724	"Baroncelli, Cosimo"	"de' Medici, Cosimo II"	Firenze/Fiorenza	43.77382166	11.25553626
1613/10/19	Santa Casa	43.44116412	13.6103721	"de' Medici, Giovanni"	"de' Medici, Cosimo II"	Firenze/Fiorenza	43.77382166	11.25553626
1613/10/19	Santa Casa	43.44116412	13.6103721	"de' Medici, Giovanni"	Unknown	Unknown	0	0
1613/10/23	Casteldurante	43.7148786	12.62039634	Livia	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1613/10/23	Casteldurante	43.7148786	12.62039634	Unnamed	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1613/12/11	Milano/Mediolani	45.46900381	9.17219094	"Solari, Gio. Battista"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1614/00/30	Illegible	 -   	 -   	"von Habsburg, Maria Magdalena"	"de' Medici, Caterina"	Siena	43.31847685	11.33107927
1614/01/19	Unknown	 -   	 -   	"Cavallo, Pietro"	"de' Medici, Cosimo II"	Firenze/Fiorenza	43.77382166	11.25553626
1614/02/06	Firenze/Fiorenza	43.77382166	11.25553626	"von Habsburg, Maria Magdalena"	"d'Elci, Orso"	Firenze/Fiorenza	43.77382166	11.25553626
1614/06/04	Firenze/Fiorenza	43.77382166	11.25553626	"de' Medici, Ferdinando II"	"de' Medici, Cosimo II"	Firenze/Fiorenza	43.77382166	11.25553626
1615/04/14	Parma	44.801472	10.328	"Aldobrandini, Margherita"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1615/04/16	Parma	44.801472	10.328	"Farnese, Ranuccio"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1615/05/13	Milano/Mediolani	45.46900381	9.17219094	"Solari, Gio. Battista"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1615/06/07	Parma	44.801472	10.328	"Farnese, Ranuccio"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1615/10/02	Cafaggiuolo	43.963866	11.29395524	"von Habsburg, Maria Magdalena"	"d'Elci, Orso"	Firenze/Fiorenza	43.77382166	11.25553626
1615/10/03	Milano/Mediolani	45.46900381	9.17219094	"B___, Berna__"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1615/10/22	Firenze/Fiorenza	43.77382166	11.25553626	"von Habsburg, Maria Magdalena"	"d'Elci, Orso"	Firenze/Fiorenza	43.77382166	11.25553626
1616/00/00	Paris	48.85865546	2.34915994	"von Habsburg, Anne"	"de' Medici, Cosimo II"	Firenze/Fiorenza	43.77382166	11.25553626
1616/00/10	Siena	43.31847685	11.33107927	Illegible	"de' Medici, Cosimo II"	Firenze/Fiorenza	43.77382166	11.25553626
1616/01/24	Unknown	 -   	 -   	"de Bianchi, Gio. Taddeo"	"de' Medici, Cosimo II"	Firenze/Fiorenza	43.77382166	11.25553626
1616/01/27	Milano/Mediolani	45.46900381	9.17219094	"Solari, Gio. Battista"	Unnamed	Casteldurante	43.7148786	12.62039634
1616/02/00	Unknown	 -   	 -   	"von Habsburg, Anne"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1616/07/04	Firenze/Fiorenza	43.77382166	11.25553626	Unnamed	"de' Medici, Caterina"	Siena	43.31847685	11.33107927
1616/08/01	Messerano	45.5966475	8.22011247	"F___, Francesco _____"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1616/09/27	Gross[ett]o	42.76356746	11.11031623	"Lazzari, Jacomo"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1616/10/01	Casteldurante	43.7148786	12.62039634	Livia	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1616/11/25	Siena	43.31847685	11.33107927	"Griffeli, Bartolomeo"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1616/12/00	Paris	48.85865546	2.34915994	"von Habsburg, Anne"	"de' Medici, Cosimo II"	Firenze/Fiorenza	43.77382166	11.25553626
1616/12/00	Paris	48.85865546	2.34915994	"von Habsburg, Anne"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1616/12/04	Siena	43.31847685	11.33107927	"Albizi, Laura"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1616/12/12	S.t Agata	 -   	 -   	"Fregolo, Horatio"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1616/12/16	Parma	44.801472	10.328	"Aldobrandini, Margherita"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1617/00/17	Firenze/Fiorenza	43.77382166	11.25553626	"Picchena, Curtio"	"de' Medici, Caterina"	Siena	43.31847685	11.33107927
1617/01/09	Siena	43.31847685	11.33107927	"Ciogni , Giovanni"	"di Lorena, Cristina"	Firenze/Fiorenza	43.77382166	11.25553626
1617/01/13	Parma	44.801472	10.328	"Farnese, Ranuccio"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1617/01/14	Siena	43.31847685	11.33107927	"Malvezzi, Peritio"	"di Lorena, Cristina"	Firenze/Fiorenza	43.77382166	11.25553626
1617/03/21	Parma	44.801472	10.328	"Farnese, Ranuccio"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1617/03/22	Siena	43.31847685	11.33107927	"Malvezzi, Peritio"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1617/03/24	Pesaro	43.91058048	12.91164842	Unnamed	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1617/03/25	Siena	43.31847685	11.33107927	"Tomasi, Elena Avvedutine"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1617/08/31	Firenze/Fiorenza	43.77382166	11.25553626	"Picchena, Curtio"	"de' Medici, Caterina"	Siena	43.31847685	11.33107927
1617/12/19	S.t Agata	 -   	 -   	"Fregolo, Horatio"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1617/12/23	Pesaro	43.91058048	12.91164842	Unnamed	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1618/03/12	Pisa	43.72251446	10.39605229	"Picchena, Curtio"	"de' Medici, Caterina"	Siena	43.31847685	11.33107927
1618/03/15	Firenze/Fiorenza	43.77382166	11.25553626	"de' Medici, Carlo"	"de' Medici, Caterina"	Siena	43.31847685	11.33107927
1618/03/15	Pisa	43.72251446	10.39605229	"von Habsburg, Maria Magdalena"	"d'Elci, Orso"	Firenze/Fiorenza	43.77382166	11.25553626
1618/03/17	Casteldurante	43.7148786	12.62039634	Unnamed	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1618/03/19	Parma	44.801472	10.328	"Aldobrandini, Margherita"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1618/03/19	Parma	44.801472	10.328	"Farnese, Ranuccio"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1618/03/20	Firenze/Fiorenza	43.77382166	11.25553626	"Picchena, Curtio"	"de' Medici, Caterina"	Siena	43.31847685	11.33107927
1618/03/20	Parma	44.801472	10.328	"Farnese, Ottavio"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1618/03/28	Firenze/Fiorenza	43.77382166	11.25553626	"de' Medici, Cosimo II"	"de' Medici, Caterina"	Siena	43.31847685	11.33107927
1618/03/28	Firenze/Fiorenza	43.77382166	11.25553626	"Picchena, Curtio"	"de' Medici, Caterina"	Siena	43.31847685	11.33107927
1618/04/03	Siena	43.31847685	11.33107927	"Malvezzi, Peritio"	"di Lorena, Cristina"	Firenze/Fiorenza	43.77382166	11.25553626
1618/04/04	Parma	44.801472	10.328	"Farnese, Ranuccio"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1618/04/08	Pesaro	43.91058048	12.91164842	Unnamed	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1618/08/28	Firenze/Fiorenza	43.77382166	11.25553626	"Picchena, Curtio"	"de' Medici, Caterina"	Siena	43.31847685	11.33107927
1619/03/26	Firenze/Fiorenza	43.77382166	11.25553626	"Picchena, Curtio"	"de' Medici, Caterina"	Siena	43.31847685	11.33107927
1619/04/08	Firenze/Fiorenza	43.77382166	11.25553626	"von Habsburg, Maria Magdalena"	"de' Medici, Caterina"	Siena	43.31847685	11.33107927
1619/05/20	Siena	43.31847685	11.33107927	"de' Medici, Cosimo II"	"de' Medici, Caterina"	Siena	43.31847685	11.33107927
1619/07/10	Siena	43.31847685	11.33107927	"Curini, Bartolomeo"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1619/09/14	Parma	44.801472	10.328	"Farnese, Ranuccio"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1619/10/20	San Secondo	44.92285553	10.22853156	"Rossi, Isabella Simonetta"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1619/10/28	Casteldurante	43.7148786	12.62039634	Unnamed	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1619/11/03	Guglio	42.36051501	10.9011705	Unnamed	"de' Medici, Cosimo II"	Firenze/Fiorenza	43.77382166	11.25553626
1619/11/08	Siena	43.31847685	11.33107927	Colomba	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1619/11/10	Firenze/Fiorenza	43.77382166	11.25553626	"de' Medici, Cosimo II"	"Benci, Alessandro"	0	0	0
1619/11/12	Firenze/Fiorenza	43.77382166	11.25553626	"Picchena, Curtio"	"de' Medici, Caterina"	Siena	43.31847685	11.33107927
1619/11/16	Parma	44.801472	10.328	"Farnese, Ranuccio"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1619/11/19	Firenze/Fiorenza	43.77382166	11.25553626	"Picchena, Curtio"	"de' Medici, Caterina"	Siena	43.31847685	11.33107927
1624/01/21	Siena	43.31847685	11.33107927	"Chigi, Agostino"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1624/12/14	Parma	44.801472	10.328	Illegible	"de' Medici, Ferdinando II"	Firenze/Fiorenza	43.77382166	11.25553626
1624/12/15	Milano/Mediolani	45.46900381	9.17219094	Unnamed	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1624/12/16	Casteldurante	43.7148786	12.62039634	Livia	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1624/12/17	S.t Agata	 -   	 -   	"Fregolo, Horatio"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1625/01/31	Parma	44.801472	10.328	"Livati, Horatio"	"Picchena, Curtio"	Firenze/Fiorenza	43.77382166	11.25553626
1625/02/00	Paris	48.85865546	2.34915994	"von Habsburg, Anne"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1625/02/00	Paris	48.85865546	2.34915994	"von Habsburg, Anne"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1626/00/30	Siena	43.31847685	11.33107927	Colomba	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1626/01/00	Colle	 -   	 -   	"Neretti, Francesco"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1626/07/18	Firenze/Fiorenza	43.77382166	11.25553626	"de' Medici, Carlo"	Unnamed	Casteldurante	43.7148786	12.62039634
1626/08/19	Firenze/Fiorenza	43.77382166	11.25553626	"de' Medici, Carlo"	"Ricasoli, Giulio"	0	0	0
1626/08/20	Piuz	 -   	 -   	"de' Medici, Claudia"	"de' Medici, Caterina"	Siena	43.31847685	11.33107927
1626/10/27	Firenze/Fiorenza	43.77382166	11.25553626	"de' Medici, Carlo"	"von Habsburg, Leopold"	0	0	0
1626/10/27	Parma	44.801472	10.328	"Livati, Horatio"	"Lombardi, Dimurgo"	0	0	0
1626/10/31	Firenze/Fiorenza	43.77382166	11.25553626	"de' Medici, Carlo"	"de' Medici, Claudia"	Pesaro	43.91058048	12.91164842
1626/12/19	Firenze/Fiorenza	43.77382166	11.25553626	"de' Medici, Carlo"	"de' Medici, Claudia"	Pesaro	43.91058048	12.91164842
1626/12/20	Ravenna	44.41406772	12.19951365	Illegible	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1626/12/21	Parma	44.801472	10.328	"Livati, Horatio"	"Lombardi, Dimurgo"	0	0	0
1626/12/23	Milano/Mediolani	45.46900381	9.17219094	"M_roni, Michele"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1626/12/26	Firenze/Fiorenza	43.77382166	11.25553626	"von Habsburg, Maria Magdalena"	"de' Medici, Caterina"	Siena	43.31847685	11.33107927
1627/05/11	Parma	44.801472	10.328	"Livati, Horatio"	"Lombardi, Dimurgo"	0	0	0
1627/07/21	Unknown	 -   	 -   	Unnamed	"de' Medici, Caterina"	Siena	43.31847685	11.33107927
1627/08/23	Siena	43.31847685	11.33107927	"de' Medici, Caterina"	"di Lorena, Cristina"	Firenze/Fiorenza	43.77382166	11.25553626
1627/08/26	Firenze/Fiorenza	43.77382166	11.25553626	"de' Medici, Lorenzo"	"de' Medici, Caterina"	Siena	43.31847685	11.33107927
1627/09/05	Firenze/Fiorenza	43.77382166	11.25553626	"de' Medici, Leonora"	"de' Medici, Caterina"	Siena	43.31847685	11.33107927
1628/01/08	Siena	43.31847685	11.33107927	"de' Medici, Caterina"	"Cioli, Andrea"	Firenze/Fiorenza	43.77382166	11.25553626
1628/01/10	Parma	44.801472	10.328	"Aldobrandini, Margherita"	"de' Medici, Ferdinando II"	Firenze/Fiorenza	43.77382166	11.25553626
1628/01/11	Siena	43.31847685	11.33107927	"de' Medici, Caterina"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1628/01/13	Siena	43.31847685	11.33107927	"de' Medici, Caterina"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1628/01/15	Mantova	45.15643725	10.79144368	"Gonzaga, Maria"	"di Lorena, Cristina"	Firenze/Fiorenza	43.77382166	11.25553626
1628/05/11	Villa Poggio Imperiale	43.75026717	11.24739624	"von Habsburg, Maria Magdalena"	"de' Medici, Caterina"	Siena	43.31847685	11.33107927
1628/06/21	Siena	43.31847685	11.33107927	"Avarigi, Lodovico"	"di Lorena, Cristina"	Firenze/Fiorenza	43.77382166	11.25553626
1628/07/18	Siena	43.31847685	11.33107927	"Avarigi, Lodovico"	"de' Medici, ?"	0	0	0
1628/10/01	Parma	44.801472	10.328	"Pallavicina, Clara Cavalca"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1628/10/01	Siena	43.31847685	11.33107927	"de' Medici, Caterina"	"de' Medici, Ferdinando II"	Firenze/Fiorenza	43.77382166	11.25553626
1628/10/14	Firenze/Fiorenza	43.77382166	11.25553626	"de' Medici, Carlo"	"de' Medici, Caterina"	Siena	43.31847685	11.33107927
1628/12/02	Parma	44.801472	10.328	"de' Medici, Gio. Carlo"	"de' Medici, Caterina"	Siena	43.31847685	11.33107927
1628/12/02	Rome	41.89962958	12.56787728	"C.M.A. Maraldus"	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1628/12/04	Mantova	45.15643725	10.79144368	"?, Marc Antonio"	Unknown	Unknown	0	0
1629/05/02	Mantova	45.15643725	10.79144368	"Gonzaga, Carlo (Charles I)"	"di Lorena, Cristina"	Firenze/Fiorenza	43.77382166	11.25553626
1629/05/04	Mantova	45.15643725	10.79144368	"Albicini, Christoforo"	Unknown	Unknown	0	0
1629/05/05	Susa	45.13855521	7.04827428	"Guiscardi, Traiano"	"di Lorena, Cristina"	Firenze/Fiorenza	43.77382166	11.25553626
1629/05/26	Careggi	43.80937994	11.24949562	"de' Medici, Carlo"	"di Lorena, Cristina"	Firenze/Fiorenza	43.77382166	11.25553626
1630/03/20	Milano/Mediolani	45.46900381	9.17219094	"Mariscalchi, Christoforo"	Unnamed	Casteldurante	43.7148786	12.62039634
1630/06/20	Acquapend.te	42.74515074	11.86398261	"Vitelli, Francesco"	"de' Medici, Ferdinando II"	Firenze/Fiorenza	43.77382166	11.25553626
1630/07/13	Illegible	 -   	 -   	Illegible	"von Habsburg, Maria Magdalena"	Firenze/Fiorenza	43.77382166	11.25553626
1630/11/24	Siena	43.31847685	11.33107927	"Bracci, Jacomo"	"de' Medici, Ferdinando II"	Firenze/Fiorenza	43.77382166	11.25553626
1631/08/02	Firenze/Fiorenza	43.77382166	11.25553626	"de' Medici, Carlo"	"Morelli, Giulio"	0	0	0
1631/11/08	Possa	 -   	 -   	"Poltri, Lorenzo"	Unnamed	Casteldurante	43.7148786	12.62039634
1634/10/28	Paris	48.85865546	2.34915994	"von Habsburg, Anne"	"de' Medici, Ferdinando II"	Firenze/Fiorenza	43.77382166	11.25553626
1636/00/00	St. Germain	48.89804741	2.09603344	"von Habsburg, Anne"	"de' Medici, Ferdinando II"	Firenze/Fiorenza	43.77382166	11.25553626`;

// Embedded fallback letters/metadata CSV used before the user uploads files.
const SAMPLE_LETTERS_CSV = `Date	Archival Collection	Archival Page (r/v)	PDF Page	Source	Source_Title	Target	Target_Title	Relationship	Cipher?	Topic	Language	Transcription	Rough Translation	Notes
1608/10/16	ASF, Mediceo del Principato, Fol 6088.			Farnese, Ranuccio	Ruler: Duca di Parma	von Habsburg, Maria Magdalena	Ruler: Arciduchessa d'Austria e Gran Duchessa di Toscana			Italian	Ser.ma Sig.ra oss.ma		Embedded sample row
1615/10/22	ASF, Acquisti e Doni, Fol 242, Ins 3.			von Habsburg, Maria Magdalena	Ruler: Arciduchessa d'Austria e Gran Duchessa di Toscana	d'Elci, Orso	Ambassador: Conte e Ambassadore	Beaurocratic		Intelligence	Italian	Quelle Cifere lasciatevi in mano da lui		Embedded sample row
1631/08/02	ASF, Miscellanea Medicea, Fol 15, Ins 5.	96r		de' Medici, Carlo	Clergy: Cardinale Decano e Principe di Toscana	Morelli, Giulio	Beaurocratic: Podesta di Prato			Italian			Embedded sample row`;

const SAMPLE_PERSON_METADATA_CSV = `Person	Wiki_EN	Wiki_IT	Treccani	Image_CreativeCommons														
Albicini, Christoforo							
Albizi, Bernardo							
Albizi, Laura							
Albizi, R___							
Aldobrandini, ?							
Aldobrandini, Margherita	https://en.wikipedia.org/wiki/Margherita_Aldobrandini	https://it.wikipedia.org/wiki/Margherita_Aldobrandini	https://www.treccani.it/enciclopedia/margherita-aldobrandini-duchessa-di-parma-e-piacenza_(Dizionario-Biografico)/	https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Margarita_Aldobrandini%2C_Duchess_of_Parma_by_Bartolome_Gonzalez%2C_held_in_the_Hermitage_collection.jpg/960px-Margarita_Aldobrandini%2C_Duchess_of_Parma_by_Bartolome_Gonzalez%2C_held_in_the_Hermitage_collection.jpg
von Habsburg, Maria Magdalena	https://en.wikipedia.org/wiki/Archduchess_Maria_Maddalena_of_Austria	https://it.wikipedia.org/wiki/Maria_Maddalena_d%27Austria	https://www.treccani.it/enciclopedia/maria-maddalena-d-austria-granduchessa-di-toscana_(Dizionario-Biografico)/	https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Maria_Maddalena_of_Austria_as_a_widow_by_Sustermans.jpg/960px-Maria_Maddalena_of_Austria_as_a_widow_by_Sustermans.jpg			`;

// ============================================================
// DATA INGESTION HELPERS
// ============================================================
// Everything below this heading is about taking uploaded text tables and
// turning them into reliable JavaScript objects the app can use.
//
// Full-world basemap configuration.

// Low-level CSV/TSV line parser that respects quoted fields.
function parseDelimitedLine(line, delimiter) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

// Full CSV/TSV parser that preserves quoted commas and multiline quoted values.
function parseCsv(csvText) {
  const text = String(csvText ?? '')
    .replace(/^\ufeff/, '')
    .replace(/\r\n|\r/g, '\n')
    .trim();
  if (!text) return [];

  const lines = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      current += char;
      if (inQuotes && next === '"') {
        current += next;
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === '\n' && !inQuotes) {
      if (current.trim()) lines.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) lines.push(current);
  if (!lines.length) return [];

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = parseDelimitedLine(lines[0], delimiter).map((cell) => cell.trim());

  return lines.slice(1).map((line) => {
    const values = parseDelimitedLine(line, delimiter);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = (values[index] ?? '').trim();
    });
    return row;
  });
}

// Basic text normalization helpers.
function asText(value) {
  return String(value ?? '').trim();
}

function normalizeHeaderName(header) {
  return asText(header)
    .replace(/^﻿/, '')
    .toLowerCase()
    .replace(/\*/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getFieldValue(row, candidateHeaders) {
  for (const header of candidateHeaders) {
    if (header in row && asText(row[header]) !== '') return row[header];
  }

  const normalizedEntries = Object.entries(row).map(([key, value]) => [normalizeHeaderName(key), value]);
  for (const header of candidateHeaders) {
    const normalizedCandidate = normalizeHeaderName(header);
    const match = normalizedEntries.find(([normalizedKey, value]) => normalizedKey === normalizedCandidate && asText(value) !== '');
    if (match) return match[1];
  }

  return '';
}

function asNumber(value) {
  const cleaned = asText(value);
  if (!cleaned || cleaned === '-' || cleaned.toLowerCase() === 'unknown') return NaN;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function validCoord(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon);
}

function makePlaceKey(label, lat, lon) {
  return `${label}__${lat}__${lon}`;
}

// Historical date parser used by the timeline and sorting logic.
function parseHistoricalDate(rawValue) {
  const raw = asText(rawValue);
  if (!raw || raw === '0' || raw === '0000/00/00') {
    return {
      raw,
      isKnown: false,
      isTimelineUsable: false,
      monthKey: null,
      sortKey: null,
      label: 'Unknown date',
    };
  }

  const exact = raw.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (!exact) {
    return {
      raw,
      isKnown: true,
      isTimelineUsable: false,
      monthKey: null,
      sortKey: null,
      label: raw,
    };
  }

  const year = Number(exact[1]);
  const month = Number(exact[2]);
  const day = Number(exact[3]);
  const hasKnownYear = year > 0;
  const hasKnownMonth = month >= 1 && month <= 12;
  const hasKnownDay = day >= 1 && day <= 31;
  const isTimelineUsable = hasKnownYear && hasKnownMonth;
  const monthKey = isTimelineUsable ? `${year}-${String(month).padStart(2, '0')}` : null;

  return {
    raw,
    year: hasKnownYear ? year : null,
    month: hasKnownMonth ? month : null,
    day: hasKnownDay ? day : null,
    isKnown: hasKnownYear,
    isTimelineUsable,
    precision: hasKnownDay ? 'day' : hasKnownMonth ? 'month' : 'year',
    monthKey,
    sortKey: isTimelineUsable ? year * 100 + month : null,
    label: raw,
  };
}

// ============================================================
// HEADER ALIAS MAPS
// ============================================================
// These alias lists are the app's translation dictionaries.
// They let a user upload spreadsheets whose column names vary slightly
// while still mapping those columns into the internal schema.
//
// Keeping these lists centralized makes later maintenance safer:
// if a new spreadsheet uses a slightly different header name, the change
// can usually be made here without touching the rest of the logic.
const GEOGRAPHY_HEADER_ALIASES = {
  date: ['Date*', 'Date'],
  sourceLoc: ['Source_Loc', 'Source Loc', 'Source Location', 'Source Place', 'From_Loc', 'From Location', 'From Place'],
  sourceLat: ['Source_Lat', 'Source Latitude', 'Source Lat', 'Source_Latitude', 'SourceLatitude', 'Source_Y', 'From_Lat', 'From Latitude', 'From Lat'],
  sourceLon: ['Source_Long', 'Source Longitude', 'Source Lon', 'Source Lng', 'Source_Longitude', 'SourceLongitude', 'Source_X', 'From_Long', 'From Longitude', 'From Lon', 'From Lng'],
  sourcePerson: ['Source', 'Sender', 'From', 'Source_Name', 'Source Name'],
  targetPerson: ['Target', 'Recipient', 'To', 'Target_Name', 'Target Name'],
  targetLoc: ['Target_Inferred_Loc', 'Target_Inferred_Location', 'Target Loc', 'Target Location', 'Target Place', 'Target_Inferred Location', 'Target Inferred Loc', 'Target Inferred Location', 'Recipient_Loc', 'Recipient Location', 'Recipient Place', 'To_Loc', 'To Location', 'To Place'],
  targetLat: ['Target_Lat', 'Target Latitude', 'Target Lat', 'Target_Latitude', 'TargetLatitude', 'Target_Y', 'Target_Inferred_Lat', 'Target_Inferred_Latitude', 'Target Inferred Lat', 'Target Inferred Latitude', 'Recipient_Lat', 'Recipient Latitude', 'Recipient Lat', 'To_Lat', 'To Latitude', 'To Lat'],
  targetLon: ['Target_Long', 'Target Longitude', 'Target Lon', 'Target Lng', 'Target_Longitude', 'TargetLongitude', 'Target_X', 'Target_Inferred_Long', 'Target_Inferred_Longitude', 'Target Inferred Long', 'Target Inferred Longitude', 'Target_Inferred_Lng', 'Recipient_Long', 'Recipient Longitude', 'Recipient Lon', 'Recipient Lng', 'To_Long', 'To Longitude', 'To Lon', 'To Lng'],
};

const LETTER_HEADER_ALIASES = {
  source: ['Source', 'Sender', 'From'],
  target: ['Target', 'Recipient', 'To'],
  archivalCollection: ['Archival Collection', 'Archival Collection ', 'Collection', 'Archive Collection'],
  archivalPage: ['Archival Page (r/v)', 'Archival Page', 'Archival Page r/v'],
  pdfPage: ['PDF Page', 'Pdf Page', 'PDF_Page'],
  date: ['Date*', 'Date'],
  sourceLoc: ['Source_Loc', 'Source Loc', 'Source Location'],
  sourceTitle: ['Source_Title', 'Source Title'],
  targetTitle: ['Target_Title', 'Target Title'],
  relationship: ['Relationship', 'Relation'],
  cipher: ['Cipher?', 'Cipher'],
  topic: ['Topic', 'Subject'],
  language: ['Language', 'Lang'],
  transcription: ['Transcription', 'Transcript'],
  translation: ['Rough Translation', 'Translation'],
  notes: ['Notes', 'Note'],
};

const PERSON_METADATA_HEADER_ALIASES = {
  person: ['Person', 'Name', 'Person Name'],
  wikiEn: ['Wiki_EN', 'Wiki EN', 'English Wikipedia', 'Wikipedia_EN', 'Wikipedia EN'],
  wikiIt: ['Wiki_IT', 'Wiki IT', 'Italian Wikipedia', 'Wikipedia_IT', 'Wikipedia IT'],
  treccani: ['Treccani'],
  imageCreativeCommons: ['Image_CreativeCommons', 'Image CreativeCommons', 'Creative Commons Image', 'Creative Commons', 'Image'],
};

// Geography-table normalization: maps uploaded headers into the internal route schema.
function normalizeGeographyRows(rows) {
  const cleaned = rows.map((row) => ({
    date: asText(getFieldValue(row, GEOGRAPHY_HEADER_ALIASES.date)),
    parsedDate: parseHistoricalDate(getFieldValue(row, GEOGRAPHY_HEADER_ALIASES.date)),
    sourceLoc: asText(getFieldValue(row, GEOGRAPHY_HEADER_ALIASES.sourceLoc)),
    sourceLat: asNumber(getFieldValue(row, GEOGRAPHY_HEADER_ALIASES.sourceLat)),
    sourceLon: asNumber(getFieldValue(row, GEOGRAPHY_HEADER_ALIASES.sourceLon)),
    sourcePerson: asText(getFieldValue(row, GEOGRAPHY_HEADER_ALIASES.sourcePerson)),
    targetPerson: asText(getFieldValue(row, GEOGRAPHY_HEADER_ALIASES.targetPerson)),
    targetLoc: asText(getFieldValue(row, GEOGRAPHY_HEADER_ALIASES.targetLoc)),
    targetLat: asNumber(getFieldValue(row, GEOGRAPHY_HEADER_ALIASES.targetLat)),
    targetLon: asNumber(getFieldValue(row, GEOGRAPHY_HEADER_ALIASES.targetLon)),
  }));

  const placeMap = new Map();

  const addPlace = (label, lat, lon, roleHint) => {
    if (!label || !validCoord(lat, lon) || (lat === 0 && lon === 0)) return null;
    const key = makePlaceKey(label, lat, lon);
    if (!placeMap.has(key)) {
      placeMap.set(key, { id: key, label, lat, lon, type: 'place', roleHint });
    }
    return key;
  };

  const normalizedRows = cleaned.map((row, idx) => {
    const sourcePlaceId = addPlace(row.sourceLoc, row.sourceLat, row.sourceLon, 'source');
    const targetPlaceId = addPlace(row.targetLoc, row.targetLat, row.targetLon, 'target');
    return {
      id: `geo_${idx + 1}`,
      ...row,
      sourcePlaceId,
      targetPlaceId,
      mappable: Boolean(sourcePlaceId && targetPlaceId),
    };
  });
  return { normalizedRows, places: Array.from(placeMap.values()) };
}

// Raw-letters-table normalization: maps uploaded headers into the inspector schema.
function normalizeLettersRows(rows) {
  return rows.map((row, idx) => {
    const source = asText(getFieldValue(row, LETTER_HEADER_ALIASES.source));
    const target = asText(getFieldValue(row, LETTER_HEADER_ALIASES.target));
    return {
      id: `letter_${idx + 1}`,
      archivalCollection: asText(getFieldValue(row, LETTER_HEADER_ALIASES.archivalCollection)),
      archivalPage: asText(getFieldValue(row, LETTER_HEADER_ALIASES.archivalPage)),
      pdfPage: asText(getFieldValue(row, LETTER_HEADER_ALIASES.pdfPage)),
      date: asText(getFieldValue(row, LETTER_HEADER_ALIASES.date)),
      parsedDate: parseHistoricalDate(getFieldValue(row, LETTER_HEADER_ALIASES.date)),
      sourceLoc: asText(getFieldValue(row, LETTER_HEADER_ALIASES.sourceLoc)),
      source,
      sourceTitle: asText(getFieldValue(row, LETTER_HEADER_ALIASES.sourceTitle)),
      target,
      targetTitle: asText(getFieldValue(row, LETTER_HEADER_ALIASES.targetTitle)),
      relationship: asText(getFieldValue(row, LETTER_HEADER_ALIASES.relationship)),
      cipher: asText(getFieldValue(row, LETTER_HEADER_ALIASES.cipher)),
      topic: asText(getFieldValue(row, LETTER_HEADER_ALIASES.topic)),
      language: asText(getFieldValue(row, LETTER_HEADER_ALIASES.language)),
      transcription: asText(getFieldValue(row, LETTER_HEADER_ALIASES.transcription)),
      translation: asText(getFieldValue(row, LETTER_HEADER_ALIASES.translation)),
      notes: asText(getFieldValue(row, LETTER_HEADER_ALIASES.notes)),
      personKey: `${source}-->${target}`,
    };
  });
}

// Person metadata joins by exact person-name match only.
// This is intentional for this prototype: no fuzzy matching, no silent
// normalization, and no guessed identity merges.
function normalizePersonMetadataRows(rows) {
  return rows
    .map((row, idx) => ({
      id: `person_meta_${idx + 1}`,
      person: asText(getFieldValue(row, PERSON_METADATA_HEADER_ALIASES.person)),
      wikiEn: asText(getFieldValue(row, PERSON_METADATA_HEADER_ALIASES.wikiEn)),
      wikiIt: asText(getFieldValue(row, PERSON_METADATA_HEADER_ALIASES.wikiIt)),
      treccani: asText(getFieldValue(row, PERSON_METADATA_HEADER_ALIASES.treccani)),
      imageCreativeCommons: asText(getFieldValue(row, PERSON_METADATA_HEADER_ALIASES.imageCreativeCommons)),
    }))
    .filter((row) => row.person);
}

// ============================================================
// EDGE AGGREGATION HELPERS
// ============================================================
// These helpers break aggregation into three clearer steps:
// 1. collect raw geographic rows into route buckets
// 2. index letter rows by person-to-person key
// 3. build final edge records used by the map and inspector
function buildEdgeBuckets(rows) {
  const edgeMap = new Map();

  for (const row of rows) {
    if (!row.mappable) continue;
    const key = `${row.sourcePlaceId}-->${row.targetPlaceId}`;
    if (!edgeMap.has(key)) {
      edgeMap.set(key, {
        id: key,
        sourcePlaceId: row.sourcePlaceId,
        targetPlaceId: row.targetPlaceId,
        dates: new Set(),
        monthKeys: new Set(),
        sources: new Set(),
        targets: new Set(),
        personKeys: new Set(),
        rows: [],
        count: 0,
      });
    }

    const bucket = edgeMap.get(key);
    bucket.count += 1;
    if (row.date) bucket.dates.add(row.date);
    if (row.parsedDate?.monthKey) bucket.monthKeys.add(row.parsedDate.monthKey);
    if (row.sourcePerson) bucket.sources.add(row.sourcePerson);
    if (row.targetPerson) bucket.targets.add(row.targetPerson);
    bucket.personKeys.add(`${row.sourcePerson}-->${row.targetPerson}`);
    bucket.rows.push(row);
  }

  return edgeMap;
}

function buildLettersByPersonKey(letters) {
  const lettersByPersonKey = new Map();
  for (const letter of letters) {
    if (!lettersByPersonKey.has(letter.personKey)) lettersByPersonKey.set(letter.personKey, []);
    lettersByPersonKey.get(letter.personKey).push(letter);
  }
  return lettersByPersonKey;
}

function finalizeAggregatedEdges(edgeMap, lettersByPersonKey) {
  return Array.from(edgeMap.values()).map((edge) => {
    const samplePairs = edge.rows.map((d) => `${d.sourcePerson} → ${d.targetPerson}`);
    const matches = new Map();

    edge.personKeys.forEach((personKey) => {
      (lettersByPersonKey.get(personKey) || []).forEach((letter) => {
        matches.set(letter.id, letter);
      });
    });

    const matchingLetters = Array.from(matches.values()).sort((a, b) => {
      const aDate = a.parsedDate?.sortKey ?? Number.MAX_SAFE_INTEGER;
      const bDate = b.parsedDate?.sortKey ?? Number.MAX_SAFE_INTEGER;
      if (aDate !== bDate) return aDate - bDate;
      return a.source.localeCompare(b.source);
    });

    return {
      ...edge,
      dates: Array.from(edge.dates),
      monthKeys: Array.from(edge.monthKeys).sort(),
      sources: Array.from(edge.sources),
      targets: Array.from(edge.targets),
      samplePairs: Array.from(new Set(samplePairs)).slice(0, 8),
      letterMetadata: matchingLetters,
    };
  });
}

// Geographic aggregation: turns normalized rows into weighted place-to-place route edges.
function aggregateEdgesFromRows(rows, letters) {
  const edgeMap = buildEdgeBuckets(rows);
  const lettersByPersonKey = buildLettersByPersonKey(letters);
  return finalizeAggregatedEdges(edgeMap, lettersByPersonKey);
}

// ============================================================
// GRAPH + PROJECTION HELPERS
// ============================================================
// These helpers convert normalized data into map-ready structures.
// Basemap projection helpers.
function createWorldProjection(width, height) {
  return geoNaturalEarth1()
    .fitExtent(
      [
        [24, 24],
        [width - 24, height - 24],
      ],
      { type: 'Sphere' }
    );
}

function projectToSvg(lon, lat, width, height) {
  const projection = createWorldProjection(width, height);
  const point = projection([lon, lat]);
  if (!point) return { x: width / 2, y: height / 2 };
  return { x: point[0], y: point[1] };
}

// Decorative water labels for the historical-map treatment.
// These are intentionally centralized so future design iterations can
// easily adjust wording, placement, or which oceans are shown.
// Use `lines` for stacked two-line labels while keeping the text horizontal.
const MAP_WATER_LABELS = [
  { id: 'atlantic-ocean', lines: ['Atlantic', 'Ocean'], lon: -43, lat: 29.5, size: 12 },
  { id: 'pacific-ocean-east', lines: ['Pacific', 'Ocean'], lon: -155, lat: 8, size: 12 },
  { id: 'pacific-ocean-west', lines: ['Pacific', 'Ocean'], lon: 138, lat: 19, size: 12 },
  { id: 'indian-ocean', lines: ['Indian', 'Ocean'], lon: 79, lat: -23, size: 12 },
  { id: 'arctic-ocean', lines: ['Arctic Ocean'], lon: 20, lat: 88, size: 11 },
  { id: 'southern-ocean', lines: ['Southern', 'Ocean'], lon: 25, lat: -58, size: 11 },
];

function curvedPath(a, b, bend = 0.16) {
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const cx = midX + nx * len * bend;
  const cy = midY + ny * len * bend;
  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
}

// Geographic graph builder: projected place nodes plus curved route paths.
function buildGraph(places, aggregatedEdges, width, height) {
  const placeById = new Map(places.map((place) => [place.id, place]));
  const edgeCountsByPlaceId = new Map();

  aggregatedEdges.forEach((edge) => {
    edgeCountsByPlaceId.set(edge.sourcePlaceId, (edgeCountsByPlaceId.get(edge.sourcePlaceId) || 0) + edge.count);
    edgeCountsByPlaceId.set(edge.targetPlaceId, (edgeCountsByPlaceId.get(edge.targetPlaceId) || 0) + edge.count);
  });

  const nodes = places.map((place) => {
    const projected = projectToSvg(place.lon, place.lat, width, height);
    const degree = edgeCountsByPlaceId.get(place.id) || 0;
    return {
      ...place,
      x: projected.x,
      y: projected.y,
      degree,
      radius: Math.max(5, Math.min(18, 5 + degree * 1.2)),
    };
  });

  const edges = aggregatedEdges
    .map((edge) => {
      const source = placeById.get(edge.sourcePlaceId);
      const target = placeById.get(edge.targetPlaceId);
      if (!source || !target) return null;
      const a = projectToSvg(source.lon, source.lat, width, height);
      const b = projectToSvg(target.lon, target.lat, width, height);
      return {
        ...edge,
        sourceLabel: source.label,
        targetLabel: target.label,
        path: curvedPath(a, b),
        midX: (a.x + b.x) / 2,
        midY: (a.y + b.y) / 2,
        width: Math.max(0.4, Math.min(3.1, 0.4 + Math.pow(edge.count, 0.72) * 0.34)),
      };
    })
    .filter(Boolean);

  return { nodes, edges, edgeCountsByPlaceId };
}

function computePersonNodeRadius(degree) {
  return Math.max(5.5, Math.min(18, 5.5 + Math.pow(Math.max(degree, 1), 0.9) * 1.0));
}

function computePersonEdgeWidth(count) {
  return Math.max(0.6, Math.min(4.2, 0.6 + Math.pow(count, 0.72) * 0.42));
}

// Person-network graph builder for the alternate analytic view.
function buildPersonGraph(rows, width, height, layoutMode, minCount = 1, searchQuery = '') {
  const personMap = new Map();
  const edgeMap = new Map();

  rows.forEach((row) => {
    const source = row.sourcePerson;
    const target = row.targetPerson;
    if (!source || !target) return;

    if (!personMap.has(source)) {
      personMap.set(source, { id: source, label: source, appearances: 0, locationCounts: new Map() });
    }
    if (!personMap.has(target)) {
      personMap.set(target, { id: target, label: target, appearances: 0, locationCounts: new Map() });
    }

    const sourcePerson = personMap.get(source);
    const targetPerson = personMap.get(target);
    sourcePerson.appearances += 1;
    targetPerson.appearances += 1;

    if (validCoord(row.sourceLat, row.sourceLon) && !(row.sourceLat === 0 && row.sourceLon === 0)) {
      const key = `${row.sourceLoc}__${row.sourceLat}__${row.sourceLon}`;
      sourcePerson.locationCounts.set(key, (sourcePerson.locationCounts.get(key) || 0) + 1);
    }
    if (validCoord(row.targetLat, row.targetLon) && !(row.targetLat === 0 && row.targetLon === 0)) {
      const key = `${row.targetLoc}__${row.targetLat}__${row.targetLon}`;
      targetPerson.locationCounts.set(key, (targetPerson.locationCounts.get(key) || 0) + 1);
    }

    const edgeKey = `${source}-->${target}`;
    if (!edgeMap.has(edgeKey)) {
      edgeMap.set(edgeKey, { id: edgeKey, source, target, count: 0, dates: new Set(), rows: [] });
    }
    const edge = edgeMap.get(edgeKey);
    edge.count += 1;
    if (row.date) edge.dates.add(row.date);
    edge.rows.push(row);
  });

  const q = searchQuery.trim().toLowerCase();
  const filteredEdgeRecords = Array.from(edgeMap.values()).filter((edge) => {
    if (edge.count < minCount) return false;
    if (!q) return true;
    const haystack = [
      edge.source,
      edge.target,
      ...Array.from(edge.dates),
      ...edge.rows.flatMap((row) => [row.sourceLoc, row.targetLoc, row.sourcePerson, row.targetPerson]),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });

  const peopleInUse = new Set();
  filteredEdgeRecords.forEach((edge) => {
    peopleInUse.add(edge.source);
    peopleInUse.add(edge.target);
  });

  let people = Array.from(personMap.values())
    .filter((person) => peopleInUse.has(person.id))
    .map((person, index, arr) => {
      let x = width / 2;
      let y = height / 2;
      let anchorLabel = '';
      let isMappable = true;

      if (layoutMode === 'geographic') {
        if (!person.locationCounts.size) {
          isMappable = false;
        } else {
          const best = Array.from(person.locationCounts.entries()).sort((a, b) => b[1] - a[1])[0][0];
          const [label, lat, lon] = best.split('__');
          const projected = projectToSvg(Number(lon), Number(lat), width, height);
          x = projected.x;
          y = projected.y;
          anchorLabel = label;
        }
      } else {
        const angle = (index / Math.max(arr.length, 1)) * Math.PI * 2;
        const ring = 210 + (index % 5) * 24;
        x = width / 2 + Math.cos(angle) * ring;
        y = height / 2 + Math.sin(angle) * ring;
      }

      return {
        ...person,
        x,
        y,
        anchorLabel,
        isMappable,
        degree: 0,
        radius: 6,
      };
    });

  if (layoutMode === 'geographic') {
    people = people.filter((person) => person.isMappable);
  }

  const personById = new Map(people.map((p) => [p.id, p]));

  const edges = filteredEdgeRecords
    .map((edge) => {
      const source = personById.get(edge.source);
      const target = personById.get(edge.target);
      if (!source || !target) return null;
      source.degree += edge.count;
      target.degree += edge.count;
      return {
        ...edge,
        sourceLabel: source.label,
        targetLabel: target.label,
        path: curvedPath({ x: source.x, y: source.y }, { x: target.x, y: target.y }, layoutMode === 'geographic' ? 0.12 : 0.22),
        width: computePersonEdgeWidth(edge.count),
        letterMetadata: edge.rows,
        samplePairs: [`${edge.source} → ${edge.target}`],
        sources: [edge.source],
        targets: [edge.target],
        dates: Array.from(edge.dates),
      };
    })
    .filter(Boolean);

  people.forEach((p) => {
    p.radius = computePersonNodeRadius(p.degree);
  });

  return { nodes: people, edges };
}

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function slugifyFilenamePart(value, fallback = 'export') {
  const cleaned = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

function makeDownloadUrl(blob) {
  return URL.createObjectURL(blob);
}

function revokeObjectUrl(url) {
  if (url) URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const text = String(value ?? '');
  const needsQuotes = text.includes(',') || text.includes('"') || text.includes(String.fromCharCode(10));
  if (!needsQuotes) return text;
  return '"' + text.replaceAll('"', '""') + '"';
}

function rowsToCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(','));
  }
  return lines.join(String.fromCharCode(10));
}

function serializeSvgForExport(svgElement, options = {}) {
  const clone = svgElement.cloneNode(true);
  const viewBox = svgElement.viewBox?.baseVal;
  const baseWidth = Math.max(1, Math.round(viewBox?.width || svgElement.clientWidth || 1100));
  const baseHeight = Math.max(1, Math.round(viewBox?.height || svgElement.clientHeight || 760));
  const padding = 28;
  const subtitleLines = Array.isArray(options.subtitleLines) ? options.subtitleLines.filter(Boolean) : [];
  const titleText = String(options.title || '').trim();
  const headerHeight = titleText || subtitleLines.length ? 86 : 0;
  const width = baseWidth + padding * 2;
  const height = baseHeight + padding * 2 + headerHeight;

  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const movedContent = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  while (clone.firstChild) {
    movedContent.appendChild(clone.firstChild);
  }
  movedContent.setAttribute('transform', `translate(${padding} ${padding + headerHeight})`);
  clone.appendChild(movedContent);

  const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  background.setAttribute('x', '0');
  background.setAttribute('y', '0');
  background.setAttribute('width', String(width));
  background.setAttribute('height', String(height));
  background.setAttribute('fill', '#f8fafc');
  clone.insertBefore(background, clone.firstChild);

  if (headerHeight) {
    const titleNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    titleNode.setAttribute('x', String(padding));
    titleNode.setAttribute('y', '38');
    titleNode.setAttribute('fill', '#0f172a');
    titleNode.setAttribute('font-size', '24');
    titleNode.setAttribute('font-weight', '700');
    titleNode.setAttribute('font-family', 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif');
    titleNode.textContent = titleText || 'Network map export';
    clone.appendChild(titleNode);

    subtitleLines.forEach((line, index) => {
      const subtitleNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      subtitleNode.setAttribute('x', String(padding));
      subtitleNode.setAttribute('y', String(62 + index * 16));
      subtitleNode.setAttribute('fill', '#475569');
      subtitleNode.setAttribute('font-size', '12');
      subtitleNode.setAttribute('font-weight', '500');
      subtitleNode.setAttribute('font-family', 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif');
      subtitleNode.textContent = line;
      clone.appendChild(subtitleNode);
    });
  }

  const markup = `<?xml version="1.0" encoding="UTF-8"?>
${new XMLSerializer().serializeToString(clone)}`;
  return { markup, width, height };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = (error) => reject(error);
    image.src = src;
  });
}

function svgMarkupToDataUrl(svgMarkup) {
  const encoded = window.btoa(unescape(encodeURIComponent(svgMarkup)));
  return `data:image/svg+xml;base64,${encoded}`;
}

async function renderSvgElementToPngBlob(svgElement, options = {}) {
  const serialized = serializeSvgForExport(svgElement, options);
  let image;
  try {
    image = await loadImage(svgMarkupToDataUrl(serialized.markup));
  } catch (primaryError) {
    const svgBlob = new Blob([serialized.markup], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = makeDownloadUrl(svgBlob);
    try {
      image = await loadImage(blobUrl);
    } finally {
      revokeObjectUrl(blobUrl);
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = serialized.width;
  canvas.height = serialized.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas context unavailable');
  context.fillStyle = '#f8fafc';
  context.fillRect(0, 0, serialized.width, serialized.height);
  context.drawImage(image, 0, 0, serialized.width, serialized.height);
  const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!pngBlob) throw new Error('PNG blob unavailable');
  return pngBlob;
}

// -----------------------------
// Theme system
// -----------------------------
// These defaults drive the major shared UI surfaces.
// The temporary color controls in the left sidebar edit these values live.
const THEME_DEFAULTS = {
  shellBg: '#eaf2f8',
  textMain: '#21384d',
  headingText: '#21384d',
  titleDisplayText: '#f8fbff',
  mutedText: '#5c748a',
  detailLabelText: '#6a8398',
  groupHeadingText: '#21384d',
  sectionTitleText: '#21384d',
  sidebarBg: '#f5f9fc',
  sidebarBorder: '#bfd1e0',
  groupBgTop: '#eef5fa',
  groupBgBottom: '#e2edf6',
  groupBorder: '#c6d7e5',
  sectionBg: '#fbfdff',
  sectionBorder: '#cddbe7',
  floatingBg: '#f8fbfe',
  floatingBorder: '#c8d7e3',
  accent: '#5a86ad',
  accentHover: '#6b96bc',
  buttonPrimaryText: '#ffffff',
  buttonPrimaryBg: '#2d4d6a',
  buttonPrimaryHover: '#416786',
  buttonPrimaryBorder: '#223d55',
  buttonPrimaryActiveBg: '#6f95b6',
  buttonPrimaryActiveHover: '#81a4c3',
  buttonPrimaryActiveBorder: '#597e9f',
  buttonSecondaryBg: '#d7e6f2',
  buttonSecondaryHover: '#c8dceb',
  buttonSecondaryBorder: '#9fb9cf',
  buttonSecondaryText: '#28435a',
  ghostHover: '#e4eef6',
  utilityPanelBg: '#eef5fa',
  utilityTintBg: '#e0ebf4',
  studioCardBg: '#e9f1f8',
  controlInputBg: '#f7fbfe',
  titleBarBg: '#dbe8f2',
  titleInputBg: '#597b9a',
  titleInputBorder: '#84a5c0',
  titlePlaceholder: '#e9f2f8',
  sliderTrackBg: '#c2d4e2',
  sliderDotBg: '#ffffff',
  sliderDotBorder: '#96aec2',
  sliderLabelActive: '#2f4b63',
  sliderLabelInactive: '#6e8599',
  toggleBgOpen: '#e1edf6',
  toggleBgClosed: '#d4e3ef',
  toggleBorder: '#adc4d6',
  toggleAccent: '#6c8faf',
  toggleText: '#3c5870',
  toggleTextHover: '#21384d',
  mapCanvasBg: '#c5d7df',
  mapFrameBg: '#efe3c7',
  mapFrameBorder: '#8e7752',
  mapLandFill: '#dfd3a5',
  mapLandStroke: '#8f7a5a',
  mapGridStroke: '#a7b8bf',
  mapEdge: '#8a5b34',
  mapEdgeHover: '#ab7648',
  mapEdgeActive: '#6e4428',
  mapEdgeSelected: '#51311d',
  mapNode: '#728679',
  mapNodeCluster: '#b56c5d',
  mapNodeAnimated: '#86523b',
  mapNodeSelected: '#40271a',
  mapNodeStroke: '#fbf5e8',
  mapLabelText: '#4e3923',
  mapLabelHalo: 'transparent',
  mapLabelFontFamily: 'Georgia, Palatino Linotype, Book Antiqua, Palatino, serif',
  mapLabelFontWeight: '400',
  mapLabelFontStyle: 'italic',
  mapLabelStroke: 'transparent',
  mapLabelStrokeWidth: '0',
  mapWaterLabelFontFamily: 'Georgia, Palatino Linotype, Book Antiqua, Palatino, serif',
  mapTextureSea: '#a9c3c8',
  mapTextureSeaLine: '#7e9da4',
  mapTextureLandTint: '#c8b97f',
  mapTextureLandLine: '#a68f62',
  mapTextureFrameWash: '#e4d1ab',
  mapTextureCompass: '#8a6a42',
  mapWarningBg: '#7f94a8',
  mapWarningText: '#ffffff',
  fileChipBg: '#cfdfec',
  fileChipBorder: '#a2bacd',
  fileChipText: '#28435a',
  textareaBg: '#fcfeff',
  textareaBorder: '#c8d8e4',
  textareaText: '#28435a',
  textareaMutedText: '#73899c',
  panelCardBg: '#fbfdff',
  panelCardBorder: '#cddbe7',
  panelCardText: '#264055',
  panelCardMutedText: '#697f92',
  panelCardHover: '#eef5fa',
  statCardBg: '#e4edf4',
  statCardText: '#28435a',
  statCardMutedText: '#687d8f',
  inputBg: '#ffffff',
  inputBorder: '#c8d7e4',
  inputText: '#29445b',
  inputPlaceholder: '#7a8fa2',
  emptyStateBg: '#eaf2f8',
  emptyStateBorder: '#c7d6e3',
  emptyStateText: '#667e92',
  emptyStateHeading: '#2b465d',
  overlayCardBg: '#f7fbfe',
  overlayCardBorder: '#c8d8e4',
  overlayCardText: '#29445b',
  overlayCardMutedText: '#6f8598',
  pickerBg: '#f8fbfe',
  pickerBorder: '#c8d8e4',
  pickerText: '#29445b',
  pickerMutedText: '#708698',
  pickerHoverBg: '#e8f1f7',
  iconButtonBg: '#e3edf4',
  iconButtonBorder: '#b1c6d7',
  iconButtonText: '#42607a',
  iconButtonHoverBg: '#d5e4ef',
  iconButtonHoverText: '#264055',
  linkText: '#4e7698',
  linkHoverText: '#365d7c',
};

const MAP_STYLE_PRESETS = {
  preModern: {
    mapCanvasBg: '#c5d7df',
    mapFrameBg: '#efe3c7',
    mapFrameBorder: '#8e7752',
    mapLandFill: '#dfd3a5',
    mapLandStroke: '#8f7a5a',
    mapGridStroke: '#a7b8bf',
    mapEdge: '#8a5b34',
    mapEdgeHover: '#ab7648',
    mapEdgeActive: '#6e4428',
    mapEdgeSelected: '#51311d',
    mapNode: '#728679',
    mapNodeCluster: '#b56c5d',
    mapNodeAnimated: '#86523b',
    mapNodeSelected: '#40271a',
    mapNodeStroke: '#fbf5e8',
    mapLabelText: '#4e3923',
    mapLabelHalo: 'transparent',
    mapLabelFontFamily: 'Georgia, Palatino Linotype, Book Antiqua, Palatino, serif',
    mapLabelFontWeight: '400',
    mapLabelFontStyle: 'italic',
    mapWaterLabelFontFamily: 'Georgia, Palatino Linotype, Book Antiqua, Palatino, serif',
    mapTextureSea: '#a9c3c8',
    mapTextureSeaLine: '#7e9da4',
    mapTextureLandTint: '#c8b97f',
    mapTextureLandLine: '#a68f62',
    mapTextureFrameWash: '#e4d1ab',
    mapTextureCompass: '#8a6a42',
    mapWarningBg: '#7f94a8',
    mapWarningText: '#ffffff',
  },
  modern: {

    mapCanvasBg: '#102544',
    mapFrameBg: '#173154',
    mapFrameBorder: '#3c5678',
    mapLandFill: '#e8ddcb',
    mapLandStroke: '#9d8f7c',
    mapGridStroke: '#3d5574',
    mapEdge: '#84a8c8',
    mapEdgeHover: '#a8c3dc',
    mapEdgeActive: '#6f95b8',
    mapEdgeSelected: '#5b748f',
    mapNode: '#7ea1ba',
    mapNodeCluster: '#b9818f',
    mapNodeAnimated: '#96adbf',
    mapNodeSelected: '#8e6a73',
    mapNodeStroke: '#f6f1e8',
    mapLabelText: '#22364f',
    mapLabelHalo: '#f3ede4',
    mapLabelFontFamily: 'Avenir Next, Century Gothic, Montserrat, Jost, Manrope, Inter, Segoe UI, sans-serif',
    mapLabelFontWeight: '600',
    mapLabelFontStyle: 'normal',
    mapLabelStroke: '#ffffff',
    mapLabelStrokeWidth: '0.65',
    mapWaterLabelFontFamily: 'Avenir Next, Century Gothic, Montserrat, Jost, Manrope, Inter, Segoe UI, sans-serif',
    mapTextureSea: '#173154',
    mapTextureSeaLine: '#314d70',
    mapTextureLandTint: '#f0e8dd',
    mapTextureLandLine: '#c9baa6',
    mapTextureFrameWash: '#1e3b60',
    mapTextureCompass: '#6a7d99',
    mapWarningBg: '#5f7f9b',
    mapWarningText: '#ffffff',
  },
};


// ============================================================
// SHARED STYLE HELPERS + SMALL UI BUILDING BLOCKS
// ============================================================
// These functions do not hold core project data logic.
// They exist to keep repeated styling and small reusable UI pieces in
// one place so the large app component below stays more readable.
//
// Small inspector row component used throughout the right-hand panel.
function museumShellClassName() {
  return 'h-screen w-full bg-[var(--shell-bg)] text-[var(--text-main)]';
}

function sidebarSurfaceClassName() {
  return 'relative overflow-visible border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] backdrop-blur-sm transition-all duration-300';
}

function groupCardClassName() {
  return 'mt-5 rounded-[28px] border border-[var(--group-border)] bg-[linear-gradient(180deg,var(--group-bg-top),var(--group-bg-bottom))] p-4 shadow-[0_14px_34px_rgba(0,0,0,0.42)]';
}

function sectionCardClassName() {
  return 'overflow-hidden rounded-2xl border border-[var(--section-border)] bg-[var(--section-bg)] shadow-[0_10px_28px_rgba(0,0,0,0.34)]';
}

function floatingCardClassName() {
  return 'rounded-2xl border border-[var(--floating-border)] bg-[var(--floating-bg)] text-[var(--text-main)] shadow-[0_18px_40px_rgba(0,0,0,0.5)] backdrop-blur';
}

function panelHeadingClassName() {
  return 'text-[32px] font-bold leading-tight tracking-[-0.02em] text-[var(--heading-text)]';
}

function groupHeadingClassName() {
  return '[font-family:Georgia,"Palatino_Linotype","Book_Antiqua",Palatino,serif] mb-3 px-2 text-[14px] font-bold uppercase tracking-[0.14em] text-[var(--group-heading-text)]';
}

function sectionTitleClassName() {
  return '[font-family:Georgia,"Palatino_Linotype","Book_Antiqua",Palatino,serif] text-[17px] font-bold leading-tight tracking-[0.005em] text-[var(--heading-text)]';
}

function detailLabelClassName() {
  return '[font-family:Georgia,"Palatino_Linotype","Book_Antiqua",Palatino,serif] text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--detail-label-text)]';
}

function serifHeadingClassName() {
  return '[font-family:Georgia,"Palatino_Linotype","Book_Antiqua",Palatino,serif] tracking-[-0.02em] text-[var(--heading-text)]';
}

function DetailRow({ label, value }) {
  return (
    <div className="border-b border-[var(--section-border)]/80 py-2 last:border-b-0">
      <div className={detailLabelClassName()}>{label}</div>
      <div className="mt-1 break-words text-sm text-[var(--text-main)]">{value || '—'}</div>
    </div>
  );
}

// Reusable summary/diagnostic stat tile.
// Use this whenever a section needs the same small card pattern:
// muted label on top, large value below.
function StatCard({ label, value }) {
  return (
    <div className="rounded-xl bg-[var(--stat-card-bg)] p-3">
      <div className="text-[var(--panel-card-muted-text)]">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

// Reusable linked-letter card used in both node and edge inspector views.
// This keeps the letter summary, expandable long-text sections, and metadata
// display consistent no matter how the user reached the inspector.
function LinkedLetterCard({
  letter,
  showAllLinkedLetters,
  isLetterSectionExpanded,
  onToggleLetterSection,
}) {
  const renderExpandableTextBlock = (sectionKey, heading, text, buttonLabel) => {
    if (!showAllLinkedLetters || !text) return null;
    const expanded = isLetterSectionExpanded(letter.id, sectionKey);
    const needsToggle = text.length > 350;
    return (
      <div className="mt-2 text-[var(--panel-card-text)]">
        <div className="font-medium text-[var(--panel-card-text)]">{heading}</div>
        <div>{expanded ? text : `${text.slice(0, 350)}${text.length > 350 ? '…' : ''}`}</div>
        {needsToggle ? (
          <button
            type="button"
            onClick={() => onToggleLetterSection(letter.id, sectionKey)}
            className="mt-1 text-xs font-medium text-[var(--panel-card-muted-text)] underline underline-offset-2 hover:text-[var(--panel-card-text)]"
          >
            {expanded ? `Show less ${buttonLabel}` : `Show full ${buttonLabel}`}
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <div className="rounded-xl bg-[var(--stat-card-bg)] p-3 text-sm">
      <div className="font-medium text-[var(--panel-card-text)]">{letter.source} → {letter.target}</div>
      <div className="mt-1 text-[var(--panel-card-muted-text)]">{letter.archivalCollection}</div>
      <div className="text-[var(--panel-card-muted-text)]">Archival page: {letter.archivalPage || '—'} </div>
      <div className="text-[var(--panel-card-muted-text)]">Relationship: {letter.relationship || '—'} | Language: {letter.language || '—'}</div>
      {renderExpandableTextBlock('notes', 'Notes', letter.notes, 'notes')}
      {renderExpandableTextBlock('transcription', 'Transcription', letter.transcription, 'transcription')}
      {renderExpandableTextBlock('translation', 'Translation', letter.translation, 'translation')}
    </div>
  );
}

// Shared expand/collapse wrapper used throughout the side panels.
// This keeps section behavior consistent and makes future editing easier:
// title, optional header content, and expandable body all live in one place.
function CollapsiblePanelSection({
  title,
  open,
  onToggle,
  headerContent = null,
  children = null,
  className = '',
  bodyClassName = 'border-t border-[var(--panel-card-border)]/70 p-4 pt-3',
}) {
  return (
    <section className={`${sectionCardClassName()} ${className}`.trim()}>
      <button type="button" onClick={onToggle} className="w-full p-4 text-left transition-colors hover:bg-[var(--panel-card-hover)]">
        <div>
          <h2 className={sectionTitleClassName()}>{title}</h2>
          {headerContent ? <div className="mt-2">{headerContent}</div> : null}
        </div>
        <div className="mt-1 flex justify-center">
          <span className="text-[15px] font-semibold text-[var(--panel-card-muted-text)]">{open ? '⌃' : '⌄'}</span>
        </div>
      </button>
      {open ? <div className={bodyClassName}>{children}</div> : null}
    </section>
  );
}

// Reusable stepped slider.
// Internal guide:
// 1. drag and click logic
// 2. keyboard accessibility
// 3. label rendering
function StepSlider({ options, value, onChange, ariaLabelPrefix }) {
  const currentIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const trackRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const clampIndex = (index) => Math.max(0, Math.min(options.length - 1, index));

  const updateFromClientX = (clientX) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    const nextIndex = clampIndex(Math.round(ratio * (options.length - 1)));
    const nextOption = options[nextIndex];
    if (nextOption) onChange(nextOption.value);
  };

  useEffect(() => {
    if (!isDragging) return undefined;

    const handleMove = (event) => {
      updateFromClientX(event.clientX);
    };

    const handleUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDragging, options]);

  const thumbPercent = options.length > 1 ? (currentIndex / (options.length - 1)) * 100 : 0;
  const columnStyle = { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` };

  return (
    <div className="pt-1">
      <div
        ref={trackRef}
        className="relative mx-4 h-7 select-none"
        onMouseDown={(event) => {
          updateFromClientX(event.clientX);
          setIsDragging(true);
        }}
        role="slider"
        aria-label={ariaLabelPrefix}
        aria-valuemin={0}
        aria-valuemax={Math.max(options.length - 1, 0)}
        aria-valuenow={currentIndex}
        aria-valuetext={options[currentIndex]?.label}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
            event.preventDefault();
            const nextIndex = clampIndex(currentIndex - 1);
            onChange(options[nextIndex].value);
          }
          if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
            event.preventDefault();
            const nextIndex = clampIndex(currentIndex + 1);
            onChange(options[nextIndex].value);
          }
          if (event.key === 'Home') {
            event.preventDefault();
            onChange(options[0].value);
          }
          if (event.key === 'End') {
            event.preventDefault();
            onChange(options[options.length - 1].value);
          }
        }}
      >
        <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--slider-track-bg)]" />
        <div className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--accent)]" style={{ width: `${thumbPercent}%` }} />
        <div className="absolute left-0 right-0 top-1/2 grid -translate-y-1/2" style={columnStyle}>
          {options.map((option, index) => {
            const active = index <= currentIndex;
            const selected = index === currentIndex;
            return (
              <div key={`${option.label}-${option.value}`} className="relative flex justify-center">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onChange(option.value);
                  }}
                  className={`h-4 w-4 rounded-full border-2 transition-all ${active ? 'border-[var(--accent)] bg-[var(--slider-dot-bg)]' : 'border-[var(--slider-dot-border)] bg-[var(--slider-dot-bg)]'} ${selected ? 'scale-110 shadow-[0_0_0_4px_rgba(143,122,86,0.16)]' : ''}`}
                  aria-label={`${ariaLabelPrefix} ${option.label}`}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 grid gap-x-1" style={columnStyle}>
        {options.map((option, index) => (
          <div
            key={`${option.label}-${option.value}-label`}
            className={`flex min-h-[2.5rem] items-start justify-center px-1 text-center text-[10px] leading-tight sm:text-[11px] ${index === currentIndex ? 'font-semibold text-[var(--slider-label-active)]' : 'text-[var(--slider-label-inactive)]'}`}
          >
            <span className="max-w-[4.75rem] whitespace-normal break-words">{option.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Styled file picker wrapper around the hidden native file input.
function FilePicker({ id, onChange }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-3">
      <input id={id} type="file" accept=".csv,text/csv" onChange={onChange} className="hidden" />
      <label htmlFor={id} className={`${buttonClassName({ variant: 'secondary' })} cursor-pointer`}>
        Choose File
      </label>
    </div>
  );
}

// Small card wrapper for the three upload sources.
// This is intentionally presentation-only: it does not own any state,
// parsing, or upload logic. Keeping it this small reduces regression risk.
function DataSourceCard({ title, fileInputId, onFileChange, currentSource }) {
  return (
    <div className="rounded-2xl border border-[var(--panel-card-border)] bg-[var(--section-bg)] p-4 shadow-[0_10px_28px_rgba(0,0,0,0.22)]">
      <div className="mb-2">
        <h2 className={sectionTitleClassName()}>{title}</h2>
      </div>
      <FilePicker id={fileInputId} onChange={onFileChange} />
      <div className="text-sm text-[var(--panel-card-muted-text)]">Current source: {currentSource}</div>
    </div>
  );
}

// Shared button styling helper used across the interface.
// Shared button helper.
// Important note: `active` means selected or toggled on, not merely hovered.
function buttonClassName({ active = false, variant = 'secondary' } = {}) {
  const base = 'rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:ring-offset-2 focus:ring-offset-[var(--shell-bg)]';
  const variants = {
    primary: 'border border-[var(--button-primary-border)] bg-[var(--button-primary-bg)] text-[var(--button-primary-text)] hover:bg-[var(--button-primary-hover)] shadow-[0_8px_18px_rgba(0,0,0,0.28)]',
    secondary: 'border border-[var(--button-secondary-border)] bg-[var(--button-secondary-bg)] text-[var(--button-secondary-text)] hover:bg-[var(--button-secondary-hover)]',
    ghost: 'bg-transparent text-[var(--muted-text)] hover:bg-[var(--ghost-hover)] hover:text-[var(--text-main)]',
  };

  if (active) {
    return `${base} border border-[var(--button-primary-active-border)] bg-[var(--button-primary-active-bg)] text-[var(--button-primary-text)] shadow-[0_10px_22px_rgba(0,0,0,0.3)] hover:bg-[var(--button-primary-active-hover)]`;
  }
  return `${base} ${variants[variant] || variants.secondary}`;
}

function edgeKeyFromRow(row) {
  return row?.mappable ? `${row.sourcePlaceId}-->${row.targetPlaceId}` : '';
}

// Sidebar toggle behavior:
// - when collapsed, Controls shows a cog and Inspector shows a magnifying glass
// - when open, both become dark blue circular close buttons
function SidebarToggle({ side, open, onToggle }) {
  const left = side === 'left';
  const panelName = left ? 'Controls' : 'Inspector';

  const closedIcon = left ? (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="currentColor">
      <path d="M12 2.4c-.7 0-1.4.1-2 .3l-.7 2.2c-.5.2-1 .4-1.5.7l-2.1-.9c-1 .6-1.8 1.4-2.4 2.4l.9 2.1c-.3.5-.5 1-.7 1.5l-2.2.7c-.2.7-.3 1.3-.3 2s.1 1.4.3 2l2.2.7c.2.5.4 1 .7 1.5l-.9 2.1c.6 1 1.4 1.8 2.4 2.4l2.1-.9c.5.3 1 .5 1.5.7l.7 2.2c.7.2 1.3.3 2 .3s1.4-.1 2-.3l.7-2.2c.5-.2 1-.4 1.5-.7l2.1.9c1-.6 1.8-1.4 2.4-2.4l-.9-2.1c.3-.5.5-1 .7-1.5l2.2-.7c.2-.7.3-1.3.3-2s-.1-1.4-.3-2l-2.2-.7c-.2-.5-.4-1-.7-1.5l.9-2.1c-.6-1-1.4-1.8-2.4-2.4l-2.1.9c-.5-.3-1-.5-1.5-.7l-.7-2.2c-.6-.2-1.3-.3-2-.3Zm0 5.4a4.2 4.2 0 1 1 0 8.4a4.2 4.2 0 0 1 0-8.4Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10.5" cy="10.5" r="5.75" />
      <path d="M15 15l5 5" />
    </svg>
  );

  const openIcon = (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );

  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        'absolute top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border shadow-[0_8px_20px_rgba(0,0,0,0.16)] transition-all duration-150 hover:shadow-[0_12px_24px_rgba(0,0,0,0.22)]',
        left ? 'right-3' : 'left-3',
        open
          ? 'border-[var(--button-primary-border)] bg-[var(--button-primary-bg)] text-[var(--button-primary-text)] hover:bg-[var(--button-primary-hover)]'
          : 'border-[var(--toggle-border)] bg-[var(--toggle-bg-open)] text-[var(--toggle-text)] hover:bg-[var(--utility-panel-bg)] hover:text-[var(--toggle-text-hover)]',
      ].join(' ')}
      aria-label={open ? `Collapse ${side} panel` : `Expand ${side} panel`}
      title={open ? `Hide ${panelName}` : `Show ${panelName}`}
    >
      <span className="sr-only">{open ? `Hide ${panelName}` : `Show ${panelName}`}</span>
      {open ? openIcon : closedIcon}
    </button>
  );
}

function buildNearbyCandidates(point, screenNodes, screenEdges, clusterSingularLabel, clusterPluralLabel) {
  const nodeCandidates = screenNodes
    .map((node) => {
      const distance = Math.hypot(point.x - node.screenX, point.y - node.screenY);
      const threshold = Math.max(4, node.screenRadius * 0.45 + 1.5);
      if (distance > threshold) return null;

      return {
        id: `node:${node.id}`,
        kind: 'node',
        label: node.label,
        subtitle: node.isCluster
          ? `${node.clusterSize} ${node.clusterSize === 1 ? clusterSingularLabel : clusterPluralLabel}`
          : `Connections: ${node.degree}`,
        distance,
        payload: node,
      };
    })
    .filter(Boolean);

  const edgeCandidates = screenEdges
    .map((edge) => {
      if (!edge.curve) return null;
      const distance = pointToQuadraticDistance(point.x, point.y, edge.curve);
      const threshold = Math.max(3, edge.screenWidth * 0.35 + 1.5);
      if (distance > threshold) return null;

      return {
        id: `edge:${edge.id}`,
        kind: 'edge',
        label: `${edge.sourceLabel} → ${edge.targetLabel}`,
        subtitle: `Weight: ${edge.count}`,
        distance,
        payload: edge,
      };
    })
    .filter(Boolean);

  return [...nodeCandidates, ...edgeCandidates]
    .sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      if (a.kind !== b.kind) return a.kind === 'node' ? -1 : 1;
      return a.label.localeCompare(b.label);
    })
    .slice(0, 12);
}

// Selection helpers.
// These centralize the logic that converts a lightweight remembered
// selection ({ kind, id }) into the full inspector-ready object.
// Keeping this outside the main app component reduces the risk of
// selection bugs when filtering, relayout, or clustering changes.
function buildClusterSelection(clusterNode) {
  const sortedMembers = (clusterNode.memberLabels || []).slice().sort((a, b) => a.localeCompare(b));
  return {
    ...clusterNode,
    __kind: 'cluster',
    placeCount: clusterNode.clusterSize,
    memberLabels: sortedMembers,
    memberLabelPreview: sortedMembers.slice(0, 20),
  };
}

function buildNodeSelection(node, graph, personMetadataByName) {
  const incidentEdges = graph.edges.filter((edge) => edge.sourceLabel === node.label || edge.targetLabel === node.label);
  const linkedLetters = Array.from(
    new Map(
      incidentEdges.flatMap((edge) => edge.letterMetadata || []).map((letter) => [letter.id, letter])
    ).values()
  ).sort((a, b) => {
    const aDate = a.parsedDate?.sortKey ?? Number.MAX_SAFE_INTEGER;
    const bDate = b.parsedDate?.sortKey ?? Number.MAX_SAFE_INTEGER;
    if (aDate !== bDate) return aDate - bDate;
    return (a.source || '').localeCompare(b.source || '');
  });
  const allDates = incidentEdges.flatMap((edge) => edge.dates || []).filter(Boolean).sort();
  const matchedPersonMetadata = personMetadataByName.get(node.label) || null;

  return {
    ...node,
    __kind: 'node',
    incidentEdgeCount: incidentEdges.length,
    linkedLetterCount: linkedLetters.length,
    linkedLetters,
    counterpartLabels: Array.from(new Set(incidentEdges.map((edge) => (edge.sourceLabel === node.label ? edge.targetLabel : edge.sourceLabel)))).slice(0, 12),
    earliestDate: allDates[0] || '',
    latestDate: allDates[allDates.length - 1] || '',
    anchorLabel: node.anchorLabel || '',
    personMetadata: matchedPersonMetadata,
  };
}

function resolveSelection(selectedSelection, graph, personMetadataByName) {
  if (!selectedSelection) return null;

  if (selectedSelection.kind === 'edge') {
    const edge = graph.edges.find((item) => item.id === selectedSelection.id);
    return edge ? { ...edge, __kind: 'edge' } : null;
  }

  if (selectedSelection.kind === 'cluster') {
    const clusterNode = graph.nodes.find((item) => item.id === selectedSelection.id && item.isCluster);
    return clusterNode ? buildClusterSelection(clusterNode) : null;
  }

  if (selectedSelection.kind === 'node') {
    const node = graph.nodes.find((item) => item.id === selectedSelection.id && !item.isCluster);
    return node ? buildNodeSelection(node, graph, personMetadataByName) : null;
  }

  return null;
}

function enrichSelectedLetters(selectedProps, personMetadataByName) {
  if (!selectedProps) return [];

  const baseLetters = selectedProps.__kind === 'edge'
    ? (selectedProps.letterMetadata || [])
    : selectedProps.__kind === 'node'
      ? (selectedProps.linkedLetters || [])
      : [];

  return baseLetters.map((letter) => ({
    ...letter,
    sourcePersonMetadata: personMetadataByName.get(letter.source) || null,
    targetPersonMetadata: personMetadataByName.get(letter.target) || null,
  }));
}

// Timeline and export helpers.
// These move date-window math and export shaping out of the main app
// component so the top-level React state reads more clearly.
function buildTimelineMonths(rows) {
  return Array.from(
    new Set(
      rows
        .filter((row) => row.parsedDate?.isTimelineUsable)
        .map((row) => row.parsedDate.monthKey)
        .filter(Boolean)
    )
  ).sort();
}

function filterRowsByTimelineWindow(rows, timelineMode, timelineMonths, rangeStart, rangeEnd) {
  if (timelineMode === 'all' || !timelineMonths.length) return rows;

  const startIndex = Math.min(rangeStart, rangeEnd);
  const endIndex = Math.max(rangeStart, rangeEnd);
  const startKey = timelineMonths[startIndex];
  const endKey = timelineMonths[endIndex];

  return rows.filter((row) => {
    if (!row.parsedDate?.isTimelineUsable || !row.parsedDate.monthKey) return false;
    return row.parsedDate.monthKey >= startKey && row.parsedDate.monthKey <= endKey;
  });
}

function buildPlaybackRows(rowsInWindow) {
  return rowsInWindow
    .filter((row) => row.parsedDate?.isTimelineUsable)
    .slice()
    .sort((a, b) => {
      const aSort = a.parsedDate?.sortKey ?? Number.MAX_SAFE_INTEGER;
      const bSort = b.parsedDate?.sortKey ?? Number.MAX_SAFE_INTEGER;
      if (aSort !== bSort) return aSort - bSort;
      return a.date.localeCompare(b.date);
    });
}

function filterRowsForPlayback(baseRows, playbackRows, playbackIndex) {
  if (!playbackRows.length || playbackIndex < 0) return baseRows;
  const visibleIds = new Set(playbackRows.slice(0, playbackIndex + 1).map((row) => row.id));
  return baseRows.filter((row) => visibleIds.has(row.id));
}

function buildTimelineBoundaryOptions(timelineMonths, rangeStart, rangeEnd) {
  const timelineYears = Array.from(new Set(timelineMonths.map((monthKey) => monthKey.split('-')[0]))).sort();
  const startMonthKey = timelineMonths[rangeStart] || '';
  const endMonthKey = timelineMonths[rangeEnd] || '';
  const startYear = startMonthKey ? startMonthKey.split('-')[0] : '';
  const startMonth = startMonthKey ? startMonthKey.split('-')[1] : '';
  const endYear = endMonthKey ? endMonthKey.split('-')[0] : '';
  const endMonth = endMonthKey ? endMonthKey.split('-')[1] : '';
  const startMonthsForYear = timelineMonths.filter((monthKey) => monthKey.startsWith(`${startYear}-`));
  const endMonthsForYear = timelineMonths.filter((monthKey) => monthKey.startsWith(`${endYear}-`));

  return {
    timelineYears,
    startYear,
    startMonth,
    endYear,
    endMonth,
    startMonthsForYear,
    endMonthsForYear,
  };
}

function resolveTimelineBoundaryIndex(timelineMonths, boundary, year, month) {
  const matchingMonths = timelineMonths.filter((monthKey) => monthKey.startsWith(`${year}-`));
  if (!matchingMonths.length) return -1;

  const fallbackMonthKey = boundary === 'start'
    ? matchingMonths[0]
    : matchingMonths[matchingMonths.length - 1];
  const targetMonthKey = `${year}-${month}`;
  const resolvedMonthKey = timelineMonths.includes(targetMonthKey)
    ? targetMonthKey
    : fallbackMonthKey;

  return timelineMonths.indexOf(resolvedMonthKey);
}

function buildExportEdgeRows(edges) {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceLabel,
    target: edge.targetLabel,
    weight: edge.count,
    dates: (edge.dates || []).join('; '),
    sources: (edge.sources || []).join('; '),
    targets: (edge.targets || []).join('; '),
    sample_pairs: (edge.samplePairs || []).join('; '),
    linked_letters: (edge.letterMetadata || []).length,
  }));
}

function buildExportNodeRows(nodes) {
  return nodes.map((node) => ({
    id: node.id,
    label: node.label,
    degree: node.degree,
    cluster_size: node.clusterSize || 1,
    is_cluster: node.isCluster ? 'yes' : 'no',
    latitude: node.lat ?? '',
    longitude: node.lon ?? '',
    anchor_location: node.anchorLabel || '',
  }));
}

function buildNodeHoverSummary(node, viewMode) {
  if (node.isCluster) {
    const singularLabel = viewMode === 'geographic' ? 'place' : 'person';
    const pluralLabel = viewMode === 'geographic' ? 'places' : 'people';
    return `${node.clusterSize} ${node.clusterSize === 1 ? singularLabel : pluralLabel}`;
  }

  return viewMode === 'geographic'
    ? `Weighted degree: ${node.degree}`
    : `Weighted connections: ${node.degree}`;
}

function buildHoverCardState(title, subtitle, point) {
  return {
    title,
    subtitle,
    x: point?.x ?? 24,
    y: point?.y ?? 24,
    clientX: point?.clientX ?? 0,
    clientY: point?.clientY ?? 0,
  };
}

function buildMapStageProps(args) {
  return {
    mapViewportRef: args.mapViewportRef,
    mapViewportSize: args.mapViewportSize,
    graph: args.graph,
    hoveredEdgeId: args.hoveredEdgeId,
    handleEdgeEnter: args.handleEdgeEnter,
    handleEdgeLeave: args.handleEdgeLeave,
    handleEdgeClick: args.handleEdgeClick,
    handleNodeHover: args.handleNodeHover,
    handleNodeClick: args.handleNodeClick,
    showLabels: args.showLabels,
    activeAnimationEdgeId: args.activeAnimationEdgeId,
    activeAnimationNodeIds: args.activeAnimationNodeIds,
    viewMode: args.viewMode,
    handleBlankMapClick: args.handleBlankMapClick,
    selectedProps: args.selectedProps,
    zoomTuning: args.zoomTuning,
    viewResetKey: args.viewResetKey,
    hoverCard: args.hoverCard,
  };
}

function buildLeftControlPanelProps(args) {
  return {
    sidebarState: {
      showLeftSidebar: args.showLeftSidebar,
      setShowLeftSidebar: args.setShowLeftSidebar,
      showDisplayControlsPanel: args.showDisplayControlsPanel,
      setShowDisplayControlsPanel: args.setShowDisplayControlsPanel,
      showTimelinePanel: args.showTimelinePanel,
      setShowTimelinePanel: args.setShowTimelinePanel,
      showExportPanel: args.showExportPanel,
      setShowExportPanel: args.setShowExportPanel,
      showSummaryPanel: args.showSummaryPanel,
      setShowSummaryPanel: args.setShowSummaryPanel,
      showThemePanel: args.showThemePanel,
      setShowThemePanel: args.setShowThemePanel,
    },
    dataInputState: {
      setGeographyCsv: args.setGeographyCsv,
      setLettersCsv: args.setLettersCsv,
      setPersonMetadataCsv: args.setPersonMetadataCsv,
      geographyFileLabel: args.geographyFileLabel,
      lettersFileLabel: args.lettersFileLabel,
      personMetadataFileLabel: args.personMetadataFileLabel,
      setGeographyFileLabel: args.setGeographyFileLabel,
      setLettersFileLabel: args.setLettersFileLabel,
      setPersonMetadataFileLabel: args.setPersonMetadataFileLabel,
      uploadSetter: args.uploadSetter,
      rowDiagnostics: args.rowDiagnostics,
    },
    displayState: {
      showLabels: args.showLabels,
      setShowLabels: args.setShowLabels,
      viewMode: args.viewMode,
      setViewMode: args.setViewMode,
      personLayoutMode: args.personLayoutMode,
      setPersonLayoutMode: args.setPersonLayoutMode,
      search: args.search,
      setSearch: args.setSearch,
      currentMinCountLabel: args.currentMinCountLabel,
      minCountOptions: args.minCountOptions,
      minCount: args.minCount,
      setMinCount: args.setMinCount,
    },
    timelineState: {
      timelineMode: args.timelineMode,
      setTimelineMode: args.setTimelineMode,
      currentRangeLabel: args.currentRangeLabel,
      timelineMonths: args.timelineMonths,
      rangeStart: args.rangeStart,
      setRangeStart: args.setRangeStart,
      rangeEnd: args.rangeEnd,
      setRangeEnd: args.setRangeEnd,
      currentPlaybackLabel: args.currentPlaybackLabel,
      currentPlaybackSpeedLabel: args.currentPlaybackSpeedLabel,
      playbackSpeedOptions: args.playbackSpeedOptions,
      playbackSpeed: args.playbackSpeed,
      setPlaybackSpeed: args.setPlaybackSpeed,
      isPlaying: args.isPlaying,
      setIsPlaying: args.setIsPlaying,
      playbackIndex: args.playbackIndex,
      setPlaybackIndex: args.setPlaybackIndex,
      selectedRowsForPlayback: args.selectedRowsForPlayback,
    },
    themeState: {
      applyThemePreset: args.applyThemePreset,
      resetTheme: args.resetTheme,
    },
    exportState: {
      handleExportSvg: args.handleExportSvg,
      handleExportPng: args.handleExportPng,
      handleExportEdgesCsv: args.handleExportEdgesCsv,
      handleExportNodesCsv: args.handleExportNodesCsv,
      graph: args.graph,
      exportStatus: args.exportStatus,
    },
  };
}

function buildRightInspectorPanelProps(args) {
  return {
    sidebar: {
      showRightSidebar: args.showRightSidebar,
      setShowRightSidebar: args.setShowRightSidebar,
      showInspectorInfo: args.showInspectorInfo,
      setShowInspectorInfo: args.setShowInspectorInfo,
    },
    inspectorState: {
      selectedProps: args.selectedProps,
      clearSelection: args.clearSelection,
      viewMode: args.viewMode,
    },
    letterState: {
      linkedLettersToShow: args.linkedLettersToShow,
      selectedLetterMetadata: args.selectedLetterMetadata,
      showAllLinkedLetters: args.showAllLinkedLetters,
      setShowAllLinkedLetters: args.setShowAllLinkedLetters,
      isLetterSectionExpanded: args.isLetterSectionExpanded,
      toggleLetterSection: args.toggleLetterSection,
    },
  };
}

// ============================================================
// MAIN MAP RENDERER
// ============================================================
// Main map renderer.
// Important sections inside this component:
// 1. viewport state
// 2. basemap and water labels
// 3. clustering and label visibility
// 4. edge rendering
// 5. node rendering
// 6. label rendering
// 7. map controls
function SvgMap({
  width,
  height,
  edges,
  nodes,
  hoveredEdgeId,
  onEdgeEnter,
  onEdgeLeave,
  onEdgeClick,
  onNodeHover,
  onNodeClick,
  showLabels,
  activeAnimationEdgeId,
  activeAnimationNodeIds,
  clusterSingularLabel = 'place',
  clusterPluralLabel = 'places',
  showBasemap = true,
  onBlankClick,
  selectedFeature,
  zoomTuning = {},
  viewResetKey = 'default',
}) {
  const svgRef = useRef(null);
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const [dragState, setDragState] = useState(null);
  const [basemapError, setBasemapError] = useState('');
  const animationFrameRef = useRef(null);
  const holdActionRef = useRef(null);
  const hasInitializedViewRef = useRef(false);
  const lastViewResetKeyRef = useRef('');
  const lastViewportSizeRef = useRef({ width: 0, height: 0 });

  const clampScale = (scale) => Math.max(0.6, Math.min(160, scale));
  const frame = { x: 20, y: 20, w: width - 40, h: height - 40 };

  const projection = useMemo(() => createWorldProjection(width, height), [width, height]);

  const defaultView = useMemo(() => buildDefaultMapView(nodes, width, height, clampScale), [nodes, width, height]);

  const basemapPathGenerator = useMemo(() => geoPath(projection), [projection]);

  const screenWaterLabels = useMemo(() => {
    return MAP_WATER_LABELS.map((item) => {
      const point = projectToSvg(item.lon, item.lat, width, height);
      return {
        ...item,
        x: point.x,
        y: point.y,
      };
    });
  }, [width, height]);
  const basemapPaths = useMemo(() => {
    try {
      const collection = feature(countries110m, countries110m.objects.countries);
      const features = collection.features || [];
      return features
        .map((country, index) => ({
          id: country.id || country.properties?.name || index,
          d: basemapPathGenerator(country),
        }))
        .filter((country) => country.d);
    } catch (error) {
      return [];
    }
  }, [basemapPathGenerator]);

  useEffect(() => {
    setBasemapError(basemapPaths.length ? '' : 'Basemap unavailable');
  }, [basemapPaths.length]);

  useEffect(() => {
    if (!nodes.length || !width || !height) return;

    const shouldRecenter =
      !hasInitializedViewRef.current ||
      lastViewResetKeyRef.current !== viewResetKey;

    if (!shouldRecenter) return;

    setView(defaultView);
    hasInitializedViewRef.current = true;
    lastViewResetKeyRef.current = viewResetKey;
    lastViewportSizeRef.current = { width, height };
  }, [defaultView, nodes.length, viewResetKey, width, height]);

  useEffect(() => {
    const previous = lastViewportSizeRef.current;

    if (!width || !height) {
      lastViewportSizeRef.current = { width, height };
      return;
    }

    if (!hasInitializedViewRef.current || !previous.width || !previous.height) {
      lastViewportSizeRef.current = { width, height };
      return;
    }

    const deltaWidth = width - previous.width;
    const deltaHeight = height - previous.height;

    if (!deltaWidth && !deltaHeight) return;

    setView((prev) => ({
      ...prev,
      tx: prev.tx + deltaWidth / 2,
      ty: prev.ty + deltaHeight / 2,
    }));

    lastViewportSizeRef.current = { width, height };
  }, [width, height]);

  const tuning = {
    nodeMinRadius: 6.4,
    edgeMinWidth: 2,
    nodeMultiplier: 2,
    edgeMultiplier: 5,
    edgeOpacity: 0.375,
    labelFontSize: 16.85,
    labelOffset: 13.7,
    labelThreshold: 1,
    clusterThreshold: 0,
    ...zoomTuning,
  };

  const clusterThresholdPx = Math.max(0, tuning.clusterThreshold);
  const labelDensityThreshold = Math.max(0, tuning.labelThreshold);
  const semanticNodeScale = Math.max(0, tuning.nodeMultiplier);
  const semanticEdgeScale = Math.max(0, tuning.edgeMultiplier);
  const baseEdgeOpacity = Math.max(0, tuning.edgeOpacity);
  const labelFontSize = Math.max(0, tuning.labelFontSize);
  const labelOffset = Math.max(0, tuning.labelOffset);

  const clusteredNodes = useMemo(
    () => buildClusteredNodes(nodes, clusterThresholdPx, clusterSingularLabel, clusterPluralLabel),
    [nodes, clusterThresholdPx, clusterPluralLabel, clusterSingularLabel]
  );

  const screenNodes = useMemo(() => {
    return clusteredNodes.map((node) => {
      const screenX = view.tx + node.x * view.scale;
      const screenY = view.ty + node.y * view.scale;
      const minRadius = tuning.nodeMinRadius;
      const computedRadius = (node.radius || 0) * semanticNodeScale;

      return {
        ...node,
        screenX,
        screenY,
        screenRadius: Math.max(minRadius, computedRadius),
        clusterTextSize: 8.8,
      };
    });
  }, [clusteredNodes, view.tx, view.ty, view.scale, semanticNodeScale, tuning.nodeMinRadius]);

  const labelCandidates = useMemo(() => {
    return screenNodes
      .map((node) => ({
        ...node,
        priority: (node.degree || 0) * 10 + (node.radius || 0),
      }))
      .sort((a, b) => b.priority - a.priority);
  }, [screenNodes]);

  const screenEdges = useMemo(() => {
    return edges.map((edge) => ({
      ...edge,
      screenPath: edge.path,
      screenWidth: Math.max(tuning.edgeMinWidth, edge.width * semanticEdgeScale),
      screenOpacity: baseEdgeOpacity,
      curve: parseQuadraticPath(edge.path),
    }));
  }, [edges, semanticEdgeScale, baseEdgeOpacity, tuning.edgeMinWidth]);

  const visibleLabelIds = useMemo(
    () => buildVisibleLabelIds(labelCandidates, showLabels, labelDensityThreshold, labelFontSize, labelOffset),
    [showLabels, labelCandidates, labelDensityThreshold, labelFontSize, labelOffset]
  );

  const zoomAtPoint = (clientX, clientY, nextScale) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;

    setView((prev) => {
      const clamped = clampScale(nextScale);
      const worldX = (px - prev.tx) / prev.scale;
      const worldY = (py - prev.ty) / prev.scale;
      return {
        scale: clamped,
        tx: px - worldX * clamped,
        ty: py - worldY * clamped,
      };
    });
  };

  const getPointerPosition = (event) => {
    const svg = svgRef.current;
    if (!svg) return { x: 24, y: 24, clientX: 0, clientY: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: Math.max(16, Math.min(rect.width - 16, event.clientX - rect.left)),
      y: Math.max(16, Math.min(rect.height - 16, event.clientY - rect.top)),
      clientX: event.clientX,
      clientY: event.clientY,
    };
  };

  const getNearbyCandidates = (point) => buildNearbyCandidates(point, screenNodes, screenEdges, clusterSingularLabel, clusterPluralLabel);

  const dispatchSelectionFromPoint = (point, fallbackKind = null, fallbackPayload = null) => {
    const candidates = getNearbyCandidates(point);

    if (fallbackKind === 'node' && fallbackPayload) {
      onNodeClick(fallbackPayload, point);
      return;
    }

    if (fallbackKind === 'edge' && fallbackPayload) {
      onEdgeClick(fallbackPayload, point);
      return;
    }

    if (candidates.length) {
      const hit = candidates[0];
      if (hit.kind === 'node') onNodeClick(hit.payload, point);
      if (hit.kind === 'edge') onEdgeClick(hit.payload, point);
      return;
    }

    onBlankClick?.();
  };

  const selectedKind = selectedFeature?.__kind || '';
  const selectedId = selectedFeature?.id || '';

  const handleWheel = (event) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
    zoomAtPoint(event.clientX, event.clientY, view.scale * factor);
  };

  const stopControlAnimation = () => {
    holdActionRef.current = null;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const handleMouseDown = (event) => {
    stopControlAnimation();
    if (event.button !== 0) return;
    setDragState({
      startX: event.clientX,
      startY: event.clientY,
      startTx: view.tx,
      startTy: view.ty,
    });
  };

  const handleMouseMove = (event) => {
    if (!dragState) return;
    setView((prev) => ({
      ...prev,
      tx: dragState.startTx + (event.clientX - dragState.startX),
      ty: dragState.startTy + (event.clientY - dragState.startY),
    }));
  };

  useEffect(() => {
    return () => {
      stopControlAnimation();
    };
  }, []);

  const handleMouseUp = () => setDragState(null);
  const handleMouseLeave = () => {
    setDragState(null);
    onEdgeLeave();
  };

  const panStep = 4.5;
  const zoomFactorPerFrame = 1.012;

  const applyZoomAroundCenter = (prev, factor) => {
    const nextScale = clampScale(prev.scale * factor);
    if (nextScale === prev.scale) return prev;
    const centerX = width / 2;
    const centerY = height / 2;
    const worldX = (centerX - prev.tx) / prev.scale;
    const worldY = (centerY - prev.ty) / prev.scale;
    return {
      ...prev,
      scale: nextScale,
      tx: centerX - worldX * nextScale,
      ty: centerY - worldY * nextScale,
    };
  };

  const startControlAnimation = (action) => {
    stopControlAnimation();
    holdActionRef.current = action;
    let lastTime = null;

    const tick = (now) => {
      if (!holdActionRef.current) return;
      if (lastTime == null) lastTime = now;
      const delta = Math.min(32, now - lastTime || 16.67);
      lastTime = now;
      const frameScale = delta / 16.67;

      setView((prev) => {
        switch (holdActionRef.current) {
          case 'panUp':
            return { ...prev, ty: prev.ty + panStep * frameScale };
          case 'panDown':
            return { ...prev, ty: prev.ty - panStep * frameScale };
          case 'panLeft':
            return { ...prev, tx: prev.tx + panStep * frameScale };
          case 'panRight':
            return { ...prev, tx: prev.tx - panStep * frameScale };
          case 'zoomIn':
            return applyZoomAroundCenter(prev, Math.pow(zoomFactorPerFrame, frameScale));
          case 'zoomOut':
            return applyZoomAroundCenter(prev, Math.pow(1 / zoomFactorPerFrame, frameScale));
          default:
            return prev;
        }
      });

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
  };

  const resetView = () => {
    stopControlAnimation();
    const duration = 220;
    const startView = { ...view };
    const targetView = defaultView;
    let startTime = null;
    const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const tick = (now) => {
      if (startTime == null) startTime = now;
      const t = Math.min(1, (now - startTime) / duration);
      const eased = easeInOutCubic(t);
      setView({
        scale: startView.scale + (targetView.scale - startView.scale) * eased,
        tx: startView.tx + (targetView.tx - startView.tx) * eased,
        ty: startView.ty + (targetView.ty - startView.ty) * eased,
      });
      if (t < 1) {
        animationFrameRef.current = requestAnimationFrame(tick);
      } else {
        animationFrameRef.current = null;
      }
    };
    animationFrameRef.current = requestAnimationFrame(tick);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[var(--map-canvas-bg)]">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full bg-[var(--map-canvas-bg)]"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={(event) => {
          if (dragState) return;
          dispatchSelectionFromPoint(getPointerPosition(event));
        }}
        style={{ cursor: dragState ? 'grabbing' : 'grab' }}
      >
        <defs>
          {/* -----------------------------
              Map texture system
              -----------------------------
              These definitions are intentionally grouped and labeled so the
              historical-map styling can be iterated on safely in future passes.
              1. clip path for the framed map area
              2. paper grain for parchment-like surface variation
              3. sea-line pattern inspired by hand-colored portolan/atlas water treatment
              4. land-line pattern for engraved hachure-style tinting
              5. ornamental compass marker for early-modern atmosphere
          */}
          <clipPath id="map-frame-clip">
            <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} rx="16" />
          </clipPath>

          <filter id="map-paper-grain" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="noise" />
            <feColorMatrix in="noise" type="saturate" values="0" result="monoNoise" />
            <feComponentTransfer in="monoNoise" result="softNoise">
              <feFuncA type="table" tableValues="0 0.035" />
            </feComponentTransfer>
          </filter>

          <pattern id="map-sea-lines" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)">
            <rect width="24" height="24" fill="transparent" />
            <path d="M -6 6 C 2 2, 10 2, 18 6 C 26 10, 34 10, 42 6" fill="none" stroke="var(--map-texture-sea-line)" strokeOpacity="0.28" strokeWidth="0.9" />
            <path d="M -6 18 C 2 14, 10 14, 18 18 C 26 22, 34 22, 42 18" fill="none" stroke="var(--map-texture-sea-line)" strokeOpacity="0.24" strokeWidth="0.8" />
          </pattern>

          <pattern id="map-land-lines" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(22)">
            <rect width="12" height="12" fill="transparent" />
            <path d="M -2 2 L 14 2" fill="none" stroke="var(--map-texture-land-line)" strokeOpacity="0.18" strokeWidth="0.55" />
            <path d="M -2 6 L 14 6" fill="none" stroke="var(--map-texture-land-line)" strokeOpacity="0.14" strokeWidth="0.48" />
            <path d="M -2 10 L 14 10" fill="none" stroke="var(--map-texture-land-line)" strokeOpacity="0.11" strokeWidth="0.42" />
          </pattern>

          <g id="map-compass-rose">
            <circle cx="0" cy="0" r="18" fill="none" stroke="var(--map-texture-compass)" strokeOpacity="0.42" strokeWidth="1" />
            <path d="M 0 -24 L 4 -4 L 0 0 L -4 -4 Z" fill="var(--map-texture-compass)" fillOpacity="0.55" />
            <path d="M 24 0 L 4 4 L 0 0 L 4 -4 Z" fill="var(--map-texture-compass)" fillOpacity="0.32" />
            <path d="M 0 24 L -4 4 L 0 0 L 4 4 Z" fill="var(--map-texture-compass)" fillOpacity="0.2" />
            <path d="M -24 0 L -4 -4 L 0 0 L -4 4 Z" fill="var(--map-texture-compass)" fillOpacity="0.32" />
            <text x="0" y="-30" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--map-texture-compass)">N</text>
          </g>
        </defs>
        <rect x="0" y="0" width={width} height={height} fill="var(--map-canvas-bg)" />
        <rect x="0" y="0" width={width} height={height} fill="var(--map-texture-sea)" opacity="0.35" filter="url(#map-paper-grain)" />
        <rect x="0" y="0" width={width} height={height} fill="url(#map-sea-lines)" opacity="0.78" />
        <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} fill="var(--map-frame-bg)" stroke="var(--map-frame-border)" strokeWidth="1.4" rx="16" />
        <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} fill="var(--map-texture-sea)" opacity="0.26" rx="16" />
        <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} fill="url(#map-sea-lines)" opacity="0.55" rx="16" />
        <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} fill="var(--map-texture-frame-wash)" opacity="0.18" filter="url(#map-paper-grain)" rx="16" />
        <rect x={frame.x + 8} y={frame.y + 8} width={frame.w - 16} height={frame.h - 16} fill="none" stroke="var(--map-frame-border)" strokeOpacity="0.35" strokeWidth="0.9" rx="12" />
        <g clipPath="url(#map-frame-clip)">
          <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}>
            {showBasemap && basemapPaths.length ? basemapPaths.map((featureItem) => (
              <g key={featureItem.id}>
                <path
                  d={featureItem.d}
                  fill="var(--map-land-fill)"
                  stroke="var(--map-land-stroke)"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                  opacity="0.94"
                />
                <path
                  d={featureItem.d}
                  fill="url(#map-land-lines)"
                  opacity="0.42"
                />
                <path
                  d={featureItem.d}
                  fill="var(--map-texture-land-tint)"
                  opacity="0.08"
                  filter="url(#map-paper-grain)"
                />
              </g>
            )) : showBasemap ? (
              <rect x="24" y="24" width={width - 48} height={height - 48} rx="24" fill="var(--map-land-fill)" opacity="0.55" />
            ) : null}
            <g opacity="0.14" stroke="var(--map-grid-stroke)" strokeWidth="1">
              <line x1="140" y1="120" x2="140" y2="680" />
              <line x1="260" y1="120" x2="260" y2="680" />
              <line x1="380" y1="120" x2="380" y2="680" />
              <line x1="500" y1="120" x2="500" y2="680" />
              <line x1="620" y1="120" x2="620" y2="680" />
              <line x1="740" y1="120" x2="740" y2="680" />
              <line x1="100" y1="180" x2="860" y2="180" />
              <line x1="100" y1="300" x2="860" y2="300" />
              <line x1="100" y1="420" x2="860" y2="420" />
              <line x1="100" y1="540" x2="860" y2="540" />
              <line x1="100" y1="660" x2="860" y2="660" />
            </g>
            <use href="#map-compass-rose" x={frame.x + frame.w - 70} y={frame.y + 72} opacity="0.5" />
            <g pointerEvents="none" opacity="0.62">
              {screenWaterLabels.map((item) => {
                const lines = Array.isArray(item.lines) && item.lines.length ? item.lines : [item.label || ''];
                const lineStep = item.size * 1.02;
                const startDy = lines.length > 1 ? -((lines.length - 1) * lineStep) / 2 : 0;
                return (
                  <text
                    key={item.id}
                    x={item.x}
                    y={item.y}
                    fill="var(--map-texture-compass)"
                    fillOpacity="0.72"
                    fontSize={item.size}
                    fontStyle="italic"
                    fontFamily="var(--map-water-label-font-family)"
                    textAnchor="middle"
                    letterSpacing="0.08em"
                  >
                    {lines.map((line, index) => (
                      <tspan
                        key={`${item.id}-line-${index}`}
                        x={item.x}
                        dy={index === 0 ? startDy : lineStep}
                      >
                        {line}
                      </tspan>
                    ))}
                  </text>
                );
              })}
            </g>
            <g>
              {screenEdges.map((edge) => {
                const isAnimated = edge.id === activeAnimationEdgeId;
                const isSelected = selectedKind === 'edge' && selectedId === edge.id;
                const edgeStroke = isSelected
                  ? 'var(--map-edge-selected)'
                  : isAnimated
                    ? 'var(--map-edge-active)'
                    : edge.id === hoveredEdgeId
                      ? 'var(--map-edge-hover)'
                      : 'var(--map-edge)';
                const edgeOpacity = isSelected
                  ? 0.92
                  : isAnimated
                    ? Math.max(0.85, edge.screenOpacity + 0.28)
                    : edge.id === hoveredEdgeId
                      ? Math.max(0.6, edge.screenOpacity + 0.2)
                      : edge.screenOpacity;
                const edgeStrokeWidth = isAnimated
                  ? edge.screenWidth + 1
                  : edge.id === hoveredEdgeId
                    ? edge.screenWidth + 0.6
                    : edge.screenWidth;
                return (
                  <path
                    key={edge.id}
                    d={edge.screenPath}
                    fill="none"
                    stroke={edgeStroke}
                    strokeOpacity={edgeOpacity}
                    strokeWidth={edgeStrokeWidth}
                    vectorEffect="non-scaling-stroke"
                    strokeLinecap="round"
                    strokeDasharray={isAnimated ? 'none' : edge.count <= 2 ? '2.5 2' : 'none'}
                    onMouseEnter={(event) => onEdgeEnter(edge, getPointerPosition(event))}
                    onClick={(event) => {
                      event.stopPropagation();
                      dispatchSelectionFromPoint(getPointerPosition(event), 'edge', edge);
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                );
              })}
            </g>
          </g>
          <g>
            {screenNodes.map((node) => {
              const isAnimated = !node.isCluster && activeAnimationNodeIds?.has(node.id);
              const isSelected =
                (selectedKind === 'node' && selectedId === node.id) ||
                (selectedKind === 'cluster' && selectedId === node.id);
              const inFrame = node.screenX >= frame.x && node.screenX <= frame.x + frame.w && node.screenY >= frame.y && node.screenY <= frame.y + frame.h;
              if (!inFrame) return null;

              const nodeFill = isSelected
                ? 'var(--map-node-selected)'
                : node.isCluster
                  ? 'var(--map-node-cluster)'
                  : isAnimated
                    ? 'var(--map-node-animated)'
                    : 'var(--map-node)';
              const nodeStroke = 'var(--map-node-stroke)';
              const nodeStrokeWidth = isSelected ? '3' : isAnimated ? '2.5' : node.isCluster ? '2' : '1.5';
              const nodeRadius = isAnimated ? node.screenRadius + 3 : node.screenRadius;

              return (
                <g
                  key={node.id}
                  onMouseEnter={(event) => onNodeHover(node, getPointerPosition(event))}
                  onClick={(event) => {
                    event.stopPropagation();
                    dispatchSelectionFromPoint(getPointerPosition(event), 'node', node);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <circle
                    cx={node.screenX}
                    cy={node.screenY}
                    r={nodeRadius}
                    fill={nodeFill}
                    fillOpacity={isSelected ? '0.98' : node.isCluster ? '0.94' : '0.9'}
                    stroke={nodeStroke}
                    strokeWidth={nodeStrokeWidth}
                  />
                  {node.isCluster ? (
                    <text x={node.screenX} y={node.screenY} textAnchor="middle" dominantBaseline="middle" fontSize={node.clusterTextSize} fontWeight="700" fill="var(--map-node-stroke)" stroke="var(--map-edge-selected)" strokeWidth="1.2" paintOrder="stroke">
                      {node.clusterSize}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
          <g pointerEvents="none">
            {screenNodes.map((node) => {
              const shouldShowLabel = visibleLabelIds.has(node.id);
              const inFrame = node.screenX >= frame.x && node.screenX <= frame.x + frame.w && node.screenY >= frame.y && node.screenY <= frame.y + frame.h;
              if (!shouldShowLabel || !inFrame) return null;
              const labelText = node.isCluster && node.topLabel ? `${node.topLabel} +${node.clusterSize - 1}` : node.label;
              return (
                <text
                  key={`label-${node.id}`}
                  x={node.screenX}
                  y={node.screenY + node.screenRadius + labelOffset}
                  textAnchor="middle"
                  fontSize={labelFontSize}
                  fontWeight="var(--map-label-font-weight)"
                  fontStyle="var(--map-label-font-style)"
                  fontFamily="var(--map-label-font-family)"
                  fill="var(--map-label-text)"
                  stroke="var(--map-label-stroke)"
                  strokeWidth="var(--map-label-stroke-width)"
                  paintOrder="stroke"
                  strokeLinejoin="round"
                  style={{ letterSpacing: '0.01em' }}
                >
                  {labelText}
                </text>
              );
            })}
          </g>
        </g>
      </svg>

      {showBasemap && basemapError ? (
        <div className="pointer-events-none absolute left-4 top-4 rounded-2xl bg-[var(--map-warning-bg)] px-3 py-2 text-xs text-[var(--map-warning-text)] shadow">
          {basemapError}
        </div>
      ) : null}
      <MapLegendOverlay nodes={nodes} edges={edges} clusterPluralLabel={clusterPluralLabel} />
      <MapControlsOverlay
        onPanUp={() => startControlAnimation('panUp')}
        onPanLeft={() => startControlAnimation('panLeft')}
        onPanDown={() => startControlAnimation('panDown')}
        onPanRight={() => startControlAnimation('panRight')}
        onZoomIn={() => startControlAnimation('zoomIn')}
        onZoomOut={() => startControlAnimation('zoomOut')}
        onStop={stopControlAnimation}
        onReset={resetView}
      />
    </div>
  );
}

function InspectorSummaryCard({ children }) {
  return (
    <div className="rounded-2xl border border-[var(--panel-card-border)]/70 bg-[var(--utility-panel-bg)] p-4 shadow-[0_8px_24px_rgba(87,58,46,0.06)]">
      {children}
    </div>
  );
}

function InspectorClearSelectionButton({ onClear }) {
  return (
    <div className="flex justify-center">
      <button type="button" onClick={onClear} className={buttonClassName()}>
        Clear selection
      </button>
    </div>
  );
}

function PersonMetadataCard({ selectedProps }) {
  if (!selectedProps?.personMetadata) return null;

  return (
    <div className="mt-4 rounded-2xl border border-[var(--panel-card-border)]/70 bg-[var(--panel-card-bg)] p-4">
      <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--panel-card-text)]">Person metadata</div>
      {selectedProps.personMetadata.imageCreativeCommons ? (
        <div className="mb-3 overflow-hidden rounded-xl border border-[var(--panel-card-border)]/70 bg-[var(--panel-card-bg)]">
          <img
            src={selectedProps.personMetadata.imageCreativeCommons}
            alt={`${selectedProps.label} portrait`}
            className="h-48 w-full object-cover"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        </div>
      ) : null}
      <div className="space-y-2 text-sm">
        {selectedProps.personMetadata.wikiEn ? <a href={selectedProps.personMetadata.wikiEn} target="_blank" rel="noreferrer" className="block text-[var(--link-text)] underline underline-offset-2 hover:text-[var(--link-hover-text)]">English Wikipedia</a> : null}
        {selectedProps.personMetadata.wikiIt ? <a href={selectedProps.personMetadata.wikiIt} target="_blank" rel="noreferrer" className="block text-[var(--link-text)] underline underline-offset-2 hover:text-[var(--link-hover-text)]">Italian Wikipedia</a> : null}
        {selectedProps.personMetadata.treccani ? <a href={selectedProps.personMetadata.treccani} target="_blank" rel="noreferrer" className="block text-[var(--link-text)] underline underline-offset-2 hover:text-[var(--link-hover-text)]">Treccani</a> : null}
        {selectedProps.personMetadata.imageCreativeCommons ? <a href={selectedProps.personMetadata.imageCreativeCommons} target="_blank" rel="noreferrer" className="block text-[var(--link-text)] underline underline-offset-2 hover:text-[var(--link-hover-text)]">Creative Commons image</a> : null}
      </div>
    </div>
  );
}

function MissingPersonMetadataCard() {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-[var(--panel-card-border)]/80 bg-[var(--panel-card-bg)] p-4 text-sm text-[var(--panel-card-muted-text)]">
      No exact-match person metadata was found for this selected person.
    </div>
  );
}

function LinkedLettersPanel({
  linkedLettersToShow,
  selectedLetterMetadata,
  showAllLinkedLetters,
  setShowAllLinkedLetters,
  isLetterSectionExpanded,
  toggleLetterSection,
}) {
  return (
    <div className="rounded-2xl border border-[var(--panel-card-border)]/70 bg-[var(--utility-panel-bg)] p-4 shadow-[0_8px_24px_rgba(87,58,46,0.06)]">
      <div className="mb-3 flex items-center justify-between gap-3 text-sm">
        <div className="font-semibold uppercase tracking-[0.16em] text-[var(--panel-card-muted-text)]">Linked letter records</div>
        <button onClick={() => setShowAllLinkedLetters((v) => !v)} className={buttonClassName()}>
          {showAllLinkedLetters ? 'Show summary only' : 'Show detailed list'}
        </button>
      </div>
      <div className="space-y-3">
        {linkedLettersToShow.length ? linkedLettersToShow.map((letter) => (
          <LinkedLetterCard
            key={letter.id}
            letter={letter}
            showAllLinkedLetters={showAllLinkedLetters}
            isLetterSectionExpanded={isLetterSectionExpanded}
            onToggleLetterSection={toggleLetterSection}
          />
        )) : <div className="text-sm text-[var(--panel-card-muted-text)]">No linked letter-table rows were found for this route in the current matching logic.</div>}
        {!showAllLinkedLetters && selectedLetterMetadata.length > 10 ? <div className="text-sm text-[var(--panel-card-muted-text)]">Showing 10 of {selectedLetterMetadata.length} linked records.</div> : null}
      </div>
    </div>
  );
}

function SummaryPanelContent({
  showSummaryPanel,
  setShowSummaryPanel,
  rowDiagnostics,
}) {
  return (
    <CollapsiblePanelSection
      title="Summary and diagnostics"
      open={showSummaryPanel}
      onToggle={() => setShowSummaryPanel((v) => !v)}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Geography rows" value={rowDiagnostics.geographyRows} />
          <StatCard label="Mappable rows" value={rowDiagnostics.mappableRows} />
          <StatCard label="Routes in view" value={rowDiagnostics.routeCount} />
          <StatCard label="Nodes in view" value={rowDiagnostics.nodeCount} />
        </div>
        <div className="rounded-xl bg-[var(--stat-card-bg)] p-3 text-[13px] text-[var(--stat-card-text)]">
          <div className="font-medium">Current dataset status</div>
          <div className="mt-2 space-y-1 text-[var(--stat-card-muted-text)]">
            <div>Normalized geographic rows: {rowDiagnostics.normalizedRows}</div>
            <div>Rows excluded as unmappable: {rowDiagnostics.unmappableRows}</div>
            <div>Rows with unknown dates: {rowDiagnostics.unknownDateRows}</div>
            <div>Rows usable for timeline playback: {rowDiagnostics.timelineUsableRows}</div>
            <div>Timeline month buckets detected: {rowDiagnostics.timelineMonths}</div>
            <div>Rows currently inside the active time filter: {rowDiagnostics.filteredRows}</div>
            <div>Letter metadata rows loaded: {rowDiagnostics.letterRows}</div>
            <div>Linked-letter matches on visible routes: {rowDiagnostics.linkedLetterMatches}</div>
            <div>Person metadata rows loaded: {rowDiagnostics.personMetadataRows}</div>
            <div>Exact person-metadata matches in current filtered set: {rowDiagnostics.exactPersonMetadataMatches}</div>
          </div>
        </div>
      </div>
    </CollapsiblePanelSection>
  );
}

function MapAppearancePanelContent({
  showThemePanel,
  setShowThemePanel,
  applyThemePreset,
  resetTheme,
}) {
  return (
    <CollapsiblePanelSection
      title="Map appearance"
      open={showThemePanel}
      onToggle={() => setShowThemePanel((v) => !v)}
      className="mt-3"
    >
      <div className="space-y-4 text-sm text-[var(--panel-card-muted-text)]">
        <div className="rounded-xl bg-[var(--stat-card-bg)] p-3 text-[13px] text-[var(--stat-card-text)]">
          Safe preset controls only. This restores theme switching without reintroducing the full design studio yet.
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => applyThemePreset('preModern')} className={buttonClassName()}>Pre-modern palette</button>
          <button onClick={() => applyThemePreset('modern')} className={buttonClassName()}>Modern palette</button>
          <button onClick={resetTheme} className={buttonClassName({ variant: 'secondary' })}>Reset theme</button>
        </div>
      </div>
    </CollapsiblePanelSection>
  );
}

function ExportPanelContent({
  showExportPanel,
  setShowExportPanel,
  handleExportSvg,
  handleExportPng,
  handleExportEdgesCsv,
  handleExportNodesCsv,
  viewMode,
  search,
  currentMinCountLabel,
  currentRangeLabel,
  graph,
  exportStatus,
}) {
  return (
    <CollapsiblePanelSection
      title="Export"
      open={showExportPanel}
      onToggle={() => setShowExportPanel((v) => !v)}
      className="mt-3"
    >
      <div className="space-y-4 text-sm text-[var(--panel-card-muted-text)]">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={handleExportSvg} className={buttonClassName()}>Export SVG</button>
          <button onClick={handleExportPng} className={buttonClassName()}>Export PNG</button>
          <button onClick={handleExportEdgesCsv} className={buttonClassName()}>Routes CSV</button>
          <button onClick={handleExportNodesCsv} className={buttonClassName()}>Nodes CSV</button>
        </div>
        <div className="rounded-xl bg-[var(--stat-card-bg)] p-3 text-[13px]">
          <div>Current export scope</div>
          <div className="mt-1">View: {viewMode === 'geographic' ? 'Geographic routes' : 'Person network'}</div>
          <div>Search: {search.trim() || 'None'}</div>
          <div>Minimum weight: {currentMinCountLabel}</div>
          <div>Date window: {currentRangeLabel}</div>
          <div>Nodes in view: {graph.nodes.length}</div>
          <div>Routes in view: {graph.edges.length}</div>
        </div>
        {exportStatus ? (
          <div className={`rounded-xl border p-3 text-[13px] ${exportStatus.kind === 'error' ? 'border-[var(--map-warning-bg)]/60 bg-[var(--panel-card-bg)] text-[var(--panel-card-text)]' : 'border-[var(--panel-card-border)]/70 bg-[var(--panel-card-bg)] text-[var(--panel-card-text)]'}`}>
            <div className="font-medium">{exportStatus.message}</div>
            {exportStatus.filename ? <div className="mt-1">File: {exportStatus.filename}</div> : null}
            {typeof exportStatus.bytes === 'number' ? <div>Size: {exportStatus.bytes.toLocaleString()} bytes</div> : null}
            {exportStatus.timestamp ? <div>Time: {exportStatus.timestamp}</div> : null}
          </div>
        ) : null}
      </div>
    </CollapsiblePanelSection>
  );
}

function MapLegendOverlay({ nodes, edges, clusterPluralLabel }) {
  return (
    <div className={`pointer-events-none absolute bottom-4 left-4 p-3 text-xs ${floatingCardClassName()}`}>
      <div className="mb-2 text-[var(--muted-text)]">Nodes: {nodes.length} | Routes: {edges.length}</div>
      <div className="mb-1 font-semibold text-[var(--text-main)]">Legend</div>
      <div className="space-y-1 text-[var(--muted-text)]">
        <div><span className="font-medium">Primary circles</span>: {clusterPluralLabel}</div>
        <div><span className="font-medium">Cluster circles</span>: low-zoom {clusterPluralLabel} clusters</div>
        <div><span className="font-medium">Curved paths</span>: aggregated {clusterPluralLabel === 'places' ? 'geographic routes' : 'person-to-person connections'}</div>
        <div><span className="font-medium">Thicker line</span>: more letters on that route</div>
        <div><span className="font-medium">Mouse wheel</span>: zoom</div>
        <div><span className="font-medium">Drag</span>: pan</div>
      </div>
    </div>
  );
}

function MapControlsOverlay({ onPanUp, onPanLeft, onPanDown, onPanRight, onZoomIn, onZoomOut, onStop, onReset }) {
  return (
    <div className={`absolute bottom-4 right-4 p-3 ${floatingCardClassName()}`}>
      <div className="mb-2 px-1 [font-family:Georgia,&quot;Palatino_Linotype&quot;,&quot;Book_Antiqua&quot;,Palatino,serif] text-[13px] font-bold uppercase tracking-[0.12em] text-[var(--group-heading-text)]">Map controls</div>
      <div className="flex flex-col gap-2">
        <div className="flex justify-center">
          <button onMouseDown={onPanUp} onMouseUp={onStop} onMouseLeave={onStop} onTouchStart={onPanUp} onTouchEnd={onStop} aria-label="Pan up" className={`${buttonClassName()} min-w-[52px] shadow-sm`}>↑</button>
        </div>
        <div className="flex gap-2">
          <button onMouseDown={onPanLeft} onMouseUp={onStop} onMouseLeave={onStop} onTouchStart={onPanLeft} onTouchEnd={onStop} aria-label="Pan left" className={`${buttonClassName()} min-w-[52px] shadow-sm`}>←</button>
          <button onMouseDown={onPanDown} onMouseUp={onStop} onMouseLeave={onStop} onTouchStart={onPanDown} onTouchEnd={onStop} aria-label="Pan down" className={`${buttonClassName()} min-w-[52px] shadow-sm`}>↓</button>
          <button onMouseDown={onPanRight} onMouseUp={onStop} onMouseLeave={onStop} onTouchStart={onPanRight} onTouchEnd={onStop} aria-label="Pan right" className={`${buttonClassName()} min-w-[52px] shadow-sm`}>→</button>
        </div>
        <div className="flex gap-2">
          <button onMouseDown={onZoomIn} onMouseUp={onStop} onMouseLeave={onStop} onTouchStart={onZoomIn} onTouchEnd={onStop} aria-label="Zoom in" className={`${buttonClassName()} min-w-[52px] shadow-sm`}>+</button>
          <button onMouseDown={onZoomOut} onMouseUp={onStop} onMouseLeave={onStop} onTouchStart={onZoomOut} onTouchEnd={onStop} aria-label="Zoom out" className={`${buttonClassName()} min-w-[52px] shadow-sm`}>−</button>
          <button onClick={onReset} aria-label="Reset map view" className={`${buttonClassName()} shadow-sm`}>Reset</button>
        </div>
      </div>
    </div>
  );
}

function HoverCardOverlay({ hoverCard, mapViewportSize }) {
  if (!hoverCard) return null;

  return (
    <div
      className="pointer-events-none absolute z-20 max-w-[320px] rounded-2xl border border-[var(--overlay-card-border)] bg-[var(--overlay-card-bg)] px-4 py-3 text-sm shadow-[0_16px_36px_rgba(0,0,0,0.26)]"
      style={{
        left: Math.min(hoverCard.x + 18, Math.max(16, mapViewportSize.width - 340)),
        top: Math.max(16, hoverCard.y + 18),
      }}
    >
      <div className="font-semibold text-[var(--overlay-card-text)]">{hoverCard.title}</div>
      <div className="mt-1 text-[var(--overlay-card-muted-text)]">{hoverCard.subtitle}</div>
    </div>
  );
}

function MapTitleBar({ pageTitle, setPageTitle }) {
  return (
    <div className="border-b border-[var(--section-border)] bg-[var(--title-bar-bg)] px-6 py-4">
      <input
        value={pageTitle}
        onChange={(e) => setPageTitle(e.target.value)}
        className="w-full rounded-xl border border-[var(--title-input-border)] bg-[var(--title-input-bg)] px-4 py-3 text-lg font-semibold text-[var(--title-display-text)] placeholder:text-[var(--title-placeholder)]"
        placeholder="Map title"
      />
    </div>
  );
}

function MapStage({
  mapViewportRef,
  mapViewportSize,
  graph,
  hoveredEdgeId,
  handleEdgeEnter,
  handleEdgeLeave,
  handleEdgeClick,
  handleNodeHover,
  handleNodeClick,
  showLabels,
  activeAnimationEdgeId,
  activeAnimationNodeIds,
  viewMode,
  handleBlankMapClick,
  selectedProps,
  zoomTuning,
  viewResetKey,
  hoverCard,
}) {
  return (
    <div ref={mapViewportRef} className="relative min-h-0 flex-1">
      {mapViewportSize.width > 0 && mapViewportSize.height > 0 ? (
        <SvgMap
          width={mapViewportSize.width}
          height={mapViewportSize.height}
          edges={graph.edges}
          nodes={graph.nodes}
          hoveredEdgeId={hoveredEdgeId}
          onEdgeEnter={handleEdgeEnter}
          onEdgeLeave={handleEdgeLeave}
          onEdgeClick={handleEdgeClick}
          onNodeHover={handleNodeHover}
          onNodeClick={handleNodeClick}
          showLabels={showLabels}
          activeAnimationEdgeId={activeAnimationEdgeId}
          activeAnimationNodeIds={activeAnimationNodeIds}
          clusterSingularLabel={viewMode === 'geographic' ? 'place' : 'person'}
          clusterPluralLabel={viewMode === 'geographic' ? 'places' : 'people'}
          onBlankClick={handleBlankMapClick}
          selectedFeature={selectedProps}
          zoomTuning={zoomTuning}
          viewResetKey={viewResetKey}
        />
      ) : null}

      <HoverCardOverlay hoverCard={hoverCard} mapViewportSize={mapViewportSize} />

    </div>
  );
}

function DisplayControlsPanelContent({
  showDisplayControlsPanel,
  setShowDisplayControlsPanel,
  showLabels,
  setShowLabels,
  viewMode,
  setViewMode,
  personLayoutMode,
  setPersonLayoutMode,
  search,
  setSearch,
  currentMinCountLabel,
  minCountOptions,
  minCount,
  setMinCount,
  timelineMode,
  setTimelineMode,
}) {
  return (
    <CollapsiblePanelSection
      title="Display controls"
      open={showDisplayControlsPanel}
      onToggle={() => setShowDisplayControlsPanel((v) => !v)}
      className="mt-3"
    >
      <div className="space-y-4 text-sm text-[var(--panel-card-muted-text)]">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setViewMode('geographic')} className={buttonClassName({ active: viewMode === 'geographic' })}>Geographic routes</button>
          <button onClick={() => setViewMode('person')} className={buttonClassName({ active: viewMode === 'person' })}>Person network</button>
        </div>
        {viewMode === 'person' ? (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setPersonLayoutMode('force')} className={buttonClassName({ active: personLayoutMode === 'force' })}>Force-directed</button>
            <button onClick={() => setPersonLayoutMode('geographic')} className={buttonClassName({ active: personLayoutMode === 'geographic' })}>Geographic anchor</button>
          </div>
        ) : null}
        <div>
          <label className="mb-1 block font-medium">Search</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={viewMode === 'geographic' ? 'e.g. Siena, Maria Magdalena, 1613' : 'e.g. Caterina, Cosimo, Siena'}
            className="w-full rounded-xl border border-[var(--input-border)]/80 bg-[var(--input-bg)] px-3 py-2 text-[var(--input-text)] placeholder:text-[var(--input-placeholder)]"
          />
        </div>
        <div>
          <label className="mb-1 block font-medium">Minimum {viewMode === 'geographic' ? 'route weight' : 'connection weight'}: {currentMinCountLabel}</label>
          <StepSlider options={minCountOptions} value={minCount} onChange={setMinCount} ariaLabelPrefix="Set minimum weight to" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowLabels((v) => !v)} className={buttonClassName({ active: showLabels })}>Node Labels</button>
          <button onClick={() => setTimelineMode((v) => v === 'all' ? 'range' : 'all')} className={buttonClassName({ active: timelineMode === 'all' })}>Show all dates</button>
        </div>
      </div>
    </CollapsiblePanelSection>
  );
}

function TimelinePanelContent({
  showTimelinePanel,
  setShowTimelinePanel,
  currentRangeLabel,
  timelineMonths,
  rangeStart,
  setRangeStart,
  rangeEnd,
  setRangeEnd,
  currentPlaybackLabel,
  currentPlaybackSpeedLabel,
  playbackSpeedOptions,
  playbackSpeed,
  setPlaybackSpeed,
  isPlaying,
  setIsPlaying,
  playbackIndex,
  setPlaybackIndex,
  selectedRowsForPlayback,
  timelineMode,
  setTimelineMode,
}) {
  const {
    timelineYears,
    startYear,
    startMonth,
    endYear,
    endMonth,
    startMonthsForYear,
    endMonthsForYear,
  } = buildTimelineBoundaryOptions(timelineMonths, rangeStart, rangeEnd);

  const setTimelineBoundaryFromParts = (boundary, year, month) => {
    const resolvedIndex = resolveTimelineBoundaryIndex(timelineMonths, boundary, year, month);
    if (resolvedIndex < 0) return;
    setTimelineMode('range');
    if (boundary === 'start') setRangeStart(resolvedIndex);
    if (boundary === 'end') setRangeEnd(resolvedIndex);
  };

  return (
    <CollapsiblePanelSection
      title="Timeline"
      open={showTimelinePanel}
      onToggle={() => setShowTimelinePanel((v) => !v)}
      className="mt-3"
    >
      <div className="space-y-3 text-[14px] leading-6 text-[var(--panel-card-muted-text)]">
        <div>Current window: {currentRangeLabel}</div>
        <div>Available month buckets: {timelineMonths.length ? `${timelineMonths[0]} to ${timelineMonths[timelineMonths.length - 1]}` : 'none detected'}</div>
        {timelineMonths.length ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-medium">Start year</label>
              <select
                value={startYear}
                onChange={(e) => setTimelineBoundaryFromParts('start', e.target.value, startMonth || '01')}
                className="w-full rounded-xl border border-[var(--input-border)]/80 bg-[var(--input-bg)] px-3 py-2 text-[var(--input-text)]"
              >
                {timelineYears.map((year) => (
                  <option key={`start-year-${year}`} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-medium">Start month</label>
              <select
                value={startMonth}
                onChange={(e) => setTimelineBoundaryFromParts('start', startYear, e.target.value)}
                className="w-full rounded-xl border border-[var(--input-border)]/80 bg-[var(--input-bg)] px-3 py-2 text-[var(--input-text)]"
              >
                {startMonthsForYear.map((monthKey) => {
                  const month = monthKey.split('-')[1];
                  return <option key={`start-month-${monthKey}`} value={month}>{month}</option>;
                })}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-medium">End year</label>
              <select
                value={endYear}
                onChange={(e) => setTimelineBoundaryFromParts('end', e.target.value, endMonth || '12')}
                className="w-full rounded-xl border border-[var(--input-border)]/80 bg-[var(--input-bg)] px-3 py-2 text-[var(--input-text)]"
              >
                {timelineYears.map((year) => (
                  <option key={`end-year-${year}`} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-medium">End month</label>
              <select
                value={endMonth}
                onChange={(e) => setTimelineBoundaryFromParts('end', endYear, e.target.value)}
                className="w-full rounded-xl border border-[var(--input-border)]/80 bg-[var(--input-bg)] px-3 py-2 text-[var(--input-text)]"
              >
                {endMonthsForYear.map((monthKey) => {
                  const month = monthKey.split('-')[1];
                  return <option key={`end-month-${monthKey}`} value={month}>{month}</option>;
                })}
              </select>
            </div>
          </div>
        ) : null}
        <div>Current animated letter date: {currentPlaybackLabel}</div>
        <div>
          <label className="mb-1 block font-medium">Playback speed: {currentPlaybackSpeedLabel}</label>
          <StepSlider options={playbackSpeedOptions} value={playbackSpeed} onChange={setPlaybackSpeed} ariaLabelPrefix="Set playback speed to" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              if (!selectedRowsForPlayback.length) return;
              setPlaybackIndex((current) => (current < 0 ? 0 : current));
              setIsPlaying(true);
            }}
            aria-label="Play animation"
            title="Play animation"
            className={buttonClassName({ active: isPlaying })}
          >
            ▶
          </button>
          <button
            onClick={() => setIsPlaying(false)}
            aria-label="Pause animation"
            title="Pause animation"
            className={buttonClassName({ active: !isPlaying && playbackIndex >= 0 })}
          >
            ❚❚
          </button>
          <button
            onClick={() => {
              setIsPlaying(false);
              setPlaybackIndex(-1);
            }}
            className={buttonClassName()}
          >
            Reset animation
          </button>
        </div>
      </div>
    </CollapsiblePanelSection>
  );
}

function DataInputsGroup({
  setGeographyCsv,
  setLettersCsv,
  setPersonMetadataCsv,
  geographyFileLabel,
  lettersFileLabel,
  personMetadataFileLabel,
  setGeographyFileLabel,
  setLettersFileLabel,
  setPersonMetadataFileLabel,
  uploadSetter,
}) {
  return (
    <div className={groupCardClassName()}>
      <div className={groupHeadingClassName()}>Data inputs</div>
      <div className="space-y-3">
        <DataSourceCard
          title="Geography table"
          fileInputId="geography-file"
          onFileChange={uploadSetter(setGeographyCsv, setGeographyFileLabel)}
          currentSource={geographyFileLabel}
        />

        <DataSourceCard
          title="Raw data table"
          fileInputId="letters-file"
          onFileChange={uploadSetter(setLettersCsv, setLettersFileLabel)}
          currentSource={lettersFileLabel}
        />

        <DataSourceCard
          title="Person metadata table"
          fileInputId="person-metadata-file"
          onFileChange={uploadSetter(setPersonMetadataCsv, setPersonMetadataFileLabel)}
          currentSource={personMetadataFileLabel}
        />
      </div>
    </div>
  );
}

function DisplayFilteringGroup({
  showSummaryPanel,
  setShowSummaryPanel,
  rowDiagnostics,
  showDisplayControlsPanel,
  setShowDisplayControlsPanel,
  showLabels,
  setShowLabels,
  viewMode,
  setViewMode,
  personLayoutMode,
  setPersonLayoutMode,
  search,
  setSearch,
  currentMinCountLabel,
  minCountOptions,
  minCount,
  setMinCount,
  timelineMode,
  setTimelineMode,
  showTimelinePanel,
  setShowTimelinePanel,
  currentRangeLabel,
  timelineMonths,
  rangeStart,
  setRangeStart,
  rangeEnd,
  setRangeEnd,
  currentPlaybackLabel,
  currentPlaybackSpeedLabel,
  playbackSpeedOptions,
  playbackSpeed,
  setPlaybackSpeed,
  isPlaying,
  setIsPlaying,
  playbackIndex,
  setPlaybackIndex,
  selectedRowsForPlayback,
  showThemePanel,
  setShowThemePanel,
  applyThemePreset,
  resetTheme,
  showExportPanel,
  setShowExportPanel,
  handleExportSvg,
  handleExportPng,
  handleExportEdgesCsv,
  handleExportNodesCsv,
  graph,
  exportStatus,
}) {
  return (
    <div className={groupCardClassName()}>
      <div className={groupHeadingClassName()}>Display and filtering</div>

      <SummaryPanelContent
        showSummaryPanel={showSummaryPanel}
        setShowSummaryPanel={setShowSummaryPanel}
        rowDiagnostics={rowDiagnostics}
      />

      <DisplayControlsPanelContent
        showDisplayControlsPanel={showDisplayControlsPanel}
        setShowDisplayControlsPanel={setShowDisplayControlsPanel}
        showLabels={showLabels}
        setShowLabels={setShowLabels}
        viewMode={viewMode}
        setViewMode={setViewMode}
        personLayoutMode={personLayoutMode}
        setPersonLayoutMode={setPersonLayoutMode}
        search={search}
        setSearch={setSearch}
        currentMinCountLabel={currentMinCountLabel}
        minCountOptions={minCountOptions}
        minCount={minCount}
        setMinCount={setMinCount}
        timelineMode={timelineMode}
        setTimelineMode={setTimelineMode}
      />

      <TimelinePanelContent
        showTimelinePanel={showTimelinePanel}
        setShowTimelinePanel={setShowTimelinePanel}
        currentRangeLabel={currentRangeLabel}
        timelineMonths={timelineMonths}
        rangeStart={rangeStart}
        setRangeStart={setRangeStart}
        rangeEnd={rangeEnd}
        setRangeEnd={setRangeEnd}
        currentPlaybackLabel={currentPlaybackLabel}
        currentPlaybackSpeedLabel={currentPlaybackSpeedLabel}
        playbackSpeedOptions={playbackSpeedOptions}
        playbackSpeed={playbackSpeed}
        setPlaybackSpeed={setPlaybackSpeed}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        playbackIndex={playbackIndex}
        setPlaybackIndex={setPlaybackIndex}
        selectedRowsForPlayback={selectedRowsForPlayback}
        timelineMode={timelineMode}
        setTimelineMode={setTimelineMode}
      />

      <MapAppearancePanelContent
        showThemePanel={showThemePanel}
        setShowThemePanel={setShowThemePanel}
        applyThemePreset={applyThemePreset}
        resetTheme={resetTheme}
      />

      <ExportPanelContent
        showExportPanel={showExportPanel}
        setShowExportPanel={setShowExportPanel}
        handleExportSvg={handleExportSvg}
        handleExportPng={handleExportPng}
        handleExportEdgesCsv={handleExportEdgesCsv}
        handleExportNodesCsv={handleExportNodesCsv}
        viewMode={viewMode}
        search={search}
        currentMinCountLabel={currentMinCountLabel}
        currentRangeLabel={currentRangeLabel}
        graph={graph}
        exportStatus={exportStatus}
      />
    </div>
  );
}

function LeftControlPanel({
  sidebarState,
  dataInputState,
  displayState,
  timelineState,
  themeState,
  exportState,
}) {
  const {
    showLeftSidebar,
    setShowLeftSidebar,
    showDisplayControlsPanel,
    setShowDisplayControlsPanel,
    showTimelinePanel,
    setShowTimelinePanel,
    showExportPanel,
    setShowExportPanel,
    showSummaryPanel,
    setShowSummaryPanel,
    showThemePanel,
    setShowThemePanel,
  } = sidebarState;

  const {
    setGeographyCsv,
    setLettersCsv,
    setPersonMetadataCsv,
    geographyFileLabel,
    lettersFileLabel,
    personMetadataFileLabel,
    setGeographyFileLabel,
    setLettersFileLabel,
    setPersonMetadataFileLabel,
    uploadSetter,
    rowDiagnostics,
  } = dataInputState;

  const {
    showLabels,
    setShowLabels,
    viewMode,
    setViewMode,
    personLayoutMode,
    setPersonLayoutMode,
    search,
    setSearch,
    currentMinCountLabel,
    minCountOptions,
    minCount,
    setMinCount,
  } = displayState;

  const {
    timelineMode,
    setTimelineMode,
    currentRangeLabel,
    timelineMonths,
    rangeStart,
    setRangeStart,
    rangeEnd,
    setRangeEnd,
    currentPlaybackLabel,
    currentPlaybackSpeedLabel,
    playbackSpeedOptions,
    playbackSpeed,
    setPlaybackSpeed,
    isPlaying,
    setIsPlaying,
    playbackIndex,
    setPlaybackIndex,
    selectedRowsForPlayback,
  } = timelineState;

  const { applyThemePreset, resetTheme } = themeState;
  const {
    handleExportSvg,
    handleExportPng,
    handleExportEdgesCsv,
    handleExportNodesCsv,
    graph,
    exportStatus,
  } = exportState;

  return (
    <aside className={`${sidebarSurfaceClassName()} border-r xl:absolute xl:left-0 xl:top-0 xl:h-full xl:z-30 ${showLeftSidebar ? 'w-[420px]' : 'w-16'}`}>
      <SidebarToggle side="left" open={showLeftSidebar} onToggle={() => setShowLeftSidebar((v) => !v)} />
      {showLeftSidebar ? (
        <div className="h-full overflow-auto p-5 pr-20">
          <h1 className={`${panelHeadingClassName()} ${serifHeadingClassName()}`}>Control Panel</h1>

          <DataInputsGroup
            setGeographyCsv={setGeographyCsv}
            setLettersCsv={setLettersCsv}
            setPersonMetadataCsv={setPersonMetadataCsv}
            geographyFileLabel={geographyFileLabel}
            lettersFileLabel={lettersFileLabel}
            personMetadataFileLabel={personMetadataFileLabel}
            setGeographyFileLabel={setGeographyFileLabel}
            setLettersFileLabel={setLettersFileLabel}
            setPersonMetadataFileLabel={setPersonMetadataFileLabel}
            uploadSetter={uploadSetter}
          />

          <DisplayFilteringGroup
            showSummaryPanel={showSummaryPanel}
            setShowSummaryPanel={setShowSummaryPanel}
            rowDiagnostics={rowDiagnostics}
            showDisplayControlsPanel={showDisplayControlsPanel}
            setShowDisplayControlsPanel={setShowDisplayControlsPanel}
            showLabels={showLabels}
            setShowLabels={setShowLabels}
            viewMode={viewMode}
            setViewMode={setViewMode}
            personLayoutMode={personLayoutMode}
            setPersonLayoutMode={setPersonLayoutMode}
            search={search}
            setSearch={setSearch}
            currentMinCountLabel={currentMinCountLabel}
            minCountOptions={minCountOptions}
            minCount={minCount}
            setMinCount={setMinCount}
            timelineMode={timelineMode}
            setTimelineMode={setTimelineMode}
            showTimelinePanel={showTimelinePanel}
            setShowTimelinePanel={setShowTimelinePanel}
            currentRangeLabel={currentRangeLabel}
            timelineMonths={timelineMonths}
            rangeStart={rangeStart}
            setRangeStart={setRangeStart}
            rangeEnd={rangeEnd}
            setRangeEnd={setRangeEnd}
            currentPlaybackLabel={currentPlaybackLabel}
            currentPlaybackSpeedLabel={currentPlaybackSpeedLabel}
            playbackSpeedOptions={playbackSpeedOptions}
            playbackSpeed={playbackSpeed}
            setPlaybackSpeed={setPlaybackSpeed}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            playbackIndex={playbackIndex}
            setPlaybackIndex={setPlaybackIndex}
            selectedRowsForPlayback={selectedRowsForPlayback}
            showThemePanel={showThemePanel}
            setShowThemePanel={setShowThemePanel}
            applyThemePreset={applyThemePreset}
            resetTheme={resetTheme}
            showExportPanel={showExportPanel}
            setShowExportPanel={setShowExportPanel}
            handleExportSvg={handleExportSvg}
            handleExportPng={handleExportPng}
            handleExportEdgesCsv={handleExportEdgesCsv}
            handleExportNodesCsv={handleExportNodesCsv}
            graph={graph}
            exportStatus={exportStatus}
          />
        </div>
      ) : null}
    </aside>
  );
}

function InspectorHeader({ showInspectorInfo, setShowInspectorInfo }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <h2 className={`${panelHeadingClassName()} ${serifHeadingClassName()} text-[24px]`}>Inspector</h2>
        <button
          type="button"
          onClick={() => setShowInspectorInfo((v) => !v)}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--icon-button-border)]/80 bg-[var(--icon-button-bg)] text-xs font-semibold text-[var(--icon-button-text)] transition-colors hover:bg-[var(--icon-button-hover-bg)] hover:text-[var(--icon-button-hover-text)]"
          aria-label="Toggle inspector information"
          title="Inspector information"
        >
          i
        </button>
      </div>
      {showInspectorInfo ? (
        <div className="mt-3 rounded-2xl border border-[var(--panel-card-border)]/70 bg-[var(--panel-card-bg)] p-3 text-sm text-[var(--panel-card-muted-text)]">
          Summary details in this panel reflect the currently selected view, date window, search filter, and minimum-weight threshold, not the full dataset.
        </div>
      ) : null}
    </div>
  );
}

function InspectorEmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--empty-state-border)]/80 bg-[var(--empty-state-bg)] p-4 text-sm text-[var(--empty-state-text)]">
      Click a place or a route to inspect it. Hovering an edge also exposes its weight.
    </div>
  );
}

function InspectorClusterView({ selectedProps, clearSelection }) {
  return (
    <div className="space-y-4">
      <InspectorSummaryCard>
        <DetailRow label="Cluster" value={selectedProps.label} />
        <DetailRow label="Places represented" value={selectedProps.placeCount} />
        <DetailRow label="Members" value={selectedProps.memberLabelPreview.join('; ')} />
      </InspectorSummaryCard>
      <InspectorClearSelectionButton onClear={clearSelection} />
    </div>
  );
}

function InspectorNodeView({
  selectedProps,
  clearSelection,
  viewMode,
  linkedLettersToShow,
  selectedLetterMetadata,
  showAllLinkedLetters,
  setShowAllLinkedLetters,
  isLetterSectionExpanded,
  toggleLetterSection,
}) {
  return (
    <div className="space-y-4">
      <InspectorSummaryCard>
        <DetailRow label={viewMode === 'geographic' ? 'Place' : 'Person'} value={selectedProps.label} />
        <DetailRow label="Latitude" value={selectedProps.lat} />
        <DetailRow label="Longitude" value={selectedProps.lon} />
        <DetailRow label="Weighted degree" value={selectedProps.degree} />
        <DetailRow label="Incident edges" value={selectedProps.incidentEdgeCount} />
        <DetailRow label="Linked letters" value={selectedProps.linkedLetterCount} />
        <DetailRow label="Correspondents" value={(selectedProps.counterpartLabels || []).join('; ')} />
        <DetailRow label="Date span" value={[selectedProps.earliestDate, selectedProps.latestDate].filter(Boolean).join(' → ')} />
        {selectedProps.anchorLabel ? <DetailRow label="Anchor location" value={selectedProps.anchorLabel} /> : null}
        {viewMode === 'person' && selectedProps.personMetadata ? (
          <PersonMetadataCard selectedProps={selectedProps} />
        ) : viewMode === 'person' ? (
          <MissingPersonMetadataCard />
        ) : null}
      </InspectorSummaryCard>

      <InspectorClearSelectionButton onClear={clearSelection} />

      <LinkedLettersPanel
        linkedLettersToShow={linkedLettersToShow}
        selectedLetterMetadata={selectedLetterMetadata}
        showAllLinkedLetters={showAllLinkedLetters}
        setShowAllLinkedLetters={setShowAllLinkedLetters}
        isLetterSectionExpanded={isLetterSectionExpanded}
        toggleLetterSection={toggleLetterSection}
      />
    </div>
  );
}

function InspectorEdgeView({
  selectedProps,
  clearSelection,
  linkedLettersToShow,
  selectedLetterMetadata,
  showAllLinkedLetters,
  setShowAllLinkedLetters,
  isLetterSectionExpanded,
  toggleLetterSection,
}) {
  return (
    <div className="space-y-4">
      <InspectorSummaryCard>
        <DetailRow label="Route" value={`${selectedProps.sourceLabel} → ${selectedProps.targetLabel}`} />
        <DetailRow label="Weight" value={selectedProps.count} />
        <DetailRow label="Dates represented" value={(selectedProps.dates || []).join('; ')} />
        <DetailRow label="Senders" value={(selectedProps.sources || []).join('; ')} />
        <DetailRow label="Recipients" value={(selectedProps.targets || []).join('; ')} />
        <DetailRow label="Sample pairs" value={(selectedProps.samplePairs || []).join('; ')} />
        <DetailRow label="Linked letters" value={(selectedProps.letterMetadata || []).length} />
      </InspectorSummaryCard>

      <InspectorClearSelectionButton onClear={clearSelection} />

      <LinkedLettersPanel
        linkedLettersToShow={linkedLettersToShow}
        selectedLetterMetadata={selectedLetterMetadata}
        showAllLinkedLetters={showAllLinkedLetters}
        setShowAllLinkedLetters={setShowAllLinkedLetters}
        isLetterSectionExpanded={isLetterSectionExpanded}
        toggleLetterSection={toggleLetterSection}
      />
    </div>
  );
}

function RightInspectorPanel({
  sidebar,
  inspectorState,
  letterState,
}) {
  const {
    showRightSidebar,
    setShowRightSidebar,
    showInspectorInfo,
    setShowInspectorInfo,
  } = sidebar;

  const {
    selectedProps,
    clearSelection,
    viewMode,
  } = inspectorState;

  const {
    linkedLettersToShow,
    selectedLetterMetadata,
    showAllLinkedLetters,
    setShowAllLinkedLetters,
    isLetterSectionExpanded,
    toggleLetterSection,
  } = letterState;
  return (
    <aside className={`${sidebarSurfaceClassName()} border-l xl:absolute xl:right-0 xl:top-0 xl:h-full xl:z-30 ${showRightSidebar ? 'w-[420px]' : 'w-16'}`}>
      <SidebarToggle side="right" open={showRightSidebar} onToggle={() => setShowRightSidebar((v) => !v)} />
      {showRightSidebar ? (
        <div className="relative h-full overflow-auto p-5 pl-20 pb-24">
          <InspectorHeader
            showInspectorInfo={showInspectorInfo}
            setShowInspectorInfo={setShowInspectorInfo}
          />

          {!selectedProps ? (
            <InspectorEmptyState />
          ) : selectedProps.__kind === 'cluster' ? (
            <InspectorClusterView selectedProps={selectedProps} clearSelection={clearSelection} />
          ) : selectedProps.__kind === 'node' ? (
            <InspectorNodeView
              selectedProps={selectedProps}
              clearSelection={clearSelection}
              viewMode={viewMode}
              linkedLettersToShow={linkedLettersToShow}
              selectedLetterMetadata={selectedLetterMetadata}
              showAllLinkedLetters={showAllLinkedLetters}
              setShowAllLinkedLetters={setShowAllLinkedLetters}
              isLetterSectionExpanded={isLetterSectionExpanded}
              toggleLetterSection={toggleLetterSection}
            />
          ) : selectedProps.__kind === 'edge' ? (
            <InspectorEdgeView
              selectedProps={selectedProps}
              clearSelection={clearSelection}
              linkedLettersToShow={linkedLettersToShow}
              selectedLetterMetadata={selectedLetterMetadata}
              showAllLinkedLetters={showAllLinkedLetters}
              setShowAllLinkedLetters={setShowAllLinkedLetters}
              isLetterSectionExpanded={isLetterSectionExpanded}
              toggleLetterSection={toggleLetterSection}
            />
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}

function AppMainWorkspace({
  pageTitle,
  setPageTitle,
  mapStageProps,
}) {
  return (
    <main className="h-full xl:pl-16 xl:pr-16">
      <div className="flex h-full flex-col">
        <MapTitleBar pageTitle={pageTitle} setPageTitle={setPageTitle} />
        <MapStage {...mapStageProps} />
      </div>
    </main>
  );
}

export default function EuropeNetworkMapApp() {
  // ------------------------------------------------------------
  // Raw uploaded or embedded source text
  // ------------------------------------------------------------
  const [geographyCsv, setGeographyCsv] = useState(SAMPLE_GEOGRAPHY_CSV);
  const [lettersCsv, setLettersCsv] = useState(SAMPLE_LETTERS_CSV);
  const [personMetadataCsv, setPersonMetadataCsv] = useState(SAMPLE_PERSON_METADATA_CSV);
  const [geographyFileLabel, setGeographyFileLabel] = useState('Sample Data');
  const [lettersFileLabel, setLettersFileLabel] = useState('Sample Data');
  const [personMetadataFileLabel, setPersonMetadataFileLabel] = useState('Sample Data');

  // ------------------------------------------------------------
  // User interaction and view state
  // ------------------------------------------------------------
  const [showLabels, setShowLabels] = useState(true);
  const [minCount, setMinCount] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedSelection, setSelectedSelection] = useState(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState('');
  const [hoverCard, setHoverCard] = useState(null);

  const [timelineMode, setTimelineMode] = useState('range');
  const [isPlaying, setIsPlaying] = useState(false);
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(0);
  const [playbackIndex, setPlaybackIndex] = useState(-1);
  const [playbackSpeed, setPlaybackSpeed] = useState(700);
  const [showAllLinkedLetters, setShowAllLinkedLetters] = useState(false);
  const [expandedLetterSections, setExpandedLetterSections] = useState({});
  const [viewMode, setViewMode] = useState('geographic');
  const [personLayoutMode, setPersonLayoutMode] = useState('force');

  
  const [showDisplayControlsPanel, setShowDisplayControlsPanel] = useState(false);
  const [showTimelinePanel, setShowTimelinePanel] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [showSummaryPanel, setShowSummaryPanel] = useState(false);
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [showLeftSidebar, setShowLeftSidebar] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(false);
  const [showInspectorInfo, setShowInspectorInfo] = useState(false);

  // ------------------------------------------------------------
  // Presentation and layout state
  // ------------------------------------------------------------
  const [pageTitle, setPageTitle] = useState('Correspondence Visualizer');
  const [exportStatus, setExportStatus] = useState(null);
  const mapViewportRef = useRef(null);
  const [mapViewportSize, setMapViewportSize] = useState({ width: 0, height: 0 });

  const [zoomTuning] = useState({
    nodeMinRadius: 6.4,
    edgeMinWidth: 2,
    nodeMultiplier: 2,
    edgeMultiplier: 5,
    edgeOpacity: 0.375,
    labelFontSize: 16.85,
    labelOffset: 13.7,
    labelThreshold: 1,
    clusterThreshold: 0,
  });
  const [themeTuning, setThemeTuning] = useState(THEME_DEFAULTS);
  const [themePresetKey, setThemePresetKey] = useState('preModern');

  const minCountOptions = [
    { label: '1', value: 1 },
    { label: '2', value: 2 },
    { label: '3', value: 3 },
    { label: '4', value: 4 },
    { label: '5', value: 5 },
    { label: '6–10', value: 6 },
    { label: '11–15', value: 11 },
    { label: '16–20', value: 16 },
    { label: '21–25', value: 21 },
    { label: '26–30', value: 26 },
    { label: '31+', value: 31 },
  ];

  const playbackSpeedOptions = [
    { label: 'Very Slow', value: 1200 },
    { label: 'Slow', value: 700 },
    { label: 'Medium', value: 350 },
    { label: 'Fast', value: 175 },
    { label: 'Very Fast', value: 90 },
  ];

  // ------------------------------------------------------------
  // Derived theme variables
  // ------------------------------------------------------------
  const themeStyleVars = useMemo(() => {
    const vars = {};
    Object.entries(themeTuning).forEach(([key, value]) => {
      const kebab = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      vars[`--${kebab}`] = value;
    });
    return vars;
  }, [themeTuning]);

  // ------------------------------------------------------------
  // Parsed and normalized source tables
  // ------------------------------------------------------------
  const geographyRows = useMemo(() => parseCsv(geographyCsv), [geographyCsv]);
  const letterRows = useMemo(() => parseCsv(lettersCsv), [lettersCsv]);
  const personMetadataRows = useMemo(() => parseCsv(personMetadataCsv), [personMetadataCsv]);
  const normalizedLetters = useMemo(() => normalizeLettersRows(letterRows), [letterRows]);
  const normalizedPersonMetadata = useMemo(() => normalizePersonMetadataRows(personMetadataRows), [personMetadataRows]);
  const personMetadataByName = useMemo(() => {
    const map = new Map();
    normalizedPersonMetadata.forEach((row) => {
      if (!map.has(row.person)) map.set(row.person, row);
    });
    return map;
  }, [normalizedPersonMetadata]);
  const { places, normalizedRows } = useMemo(() => normalizeGeographyRows(geographyRows), [geographyRows]);

  // ------------------------------------------------------------
  // Timeline derivations
  // ------------------------------------------------------------
  const timelineMonths = useMemo(() => buildTimelineMonths(normalizedRows), [normalizedRows]);

  useEffect(() => {
    if (!timelineMonths.length) {
      setRangeStart(0);
      setRangeEnd(0);
      setPlaybackIndex(-1);
      return;
    }
    setRangeStart(0);
    setRangeEnd(timelineMonths.length - 1);
    setPlaybackIndex(-1);
  }, [timelineMonths.length]);

  const selectedRowsForPlayback = useMemo(() => {
    const rowsInWindow = filterRowsByTimelineWindow(normalizedRows, timelineMode, timelineMonths, rangeStart, rangeEnd);
    return buildPlaybackRows(rowsInWindow);
  }, [normalizedRows, timelineMode, timelineMonths, rangeStart, rangeEnd]);

  useEffect(() => {
    if (!isPlaying || !selectedRowsForPlayback.length) return undefined;
    const timer = window.setInterval(() => {
      setPlaybackIndex((current) => {
        const next = current + 1;
        if (next >= selectedRowsForPlayback.length) {
          setIsPlaying(false);
          return selectedRowsForPlayback.length - 1;
        }
        return next;
      });
    }, playbackSpeed);
    return () => window.clearInterval(timer);
  }, [isPlaying, selectedRowsForPlayback, playbackSpeed]);

  const filteredRowsByTime = useMemo(() => {
    const baseRows = filterRowsByTimelineWindow(normalizedRows, timelineMode, timelineMonths, rangeStart, rangeEnd);
    return filterRowsForPlayback(baseRows, selectedRowsForPlayback, playbackIndex);
  }, [normalizedRows, timelineMode, timelineMonths, rangeStart, rangeEnd, playbackIndex, selectedRowsForPlayback]);

  // ------------------------------------------------------------
  // Graph derivations
  // ------------------------------------------------------------
  const aggregatedEdges = useMemo(() => aggregateEdgesFromRows(filteredRowsByTime, normalizedLetters), [filteredRowsByTime, normalizedLetters]);

  const filteredAggregatedEdges = useMemo(() => {
    const q = search.trim().toLowerCase();
    return aggregatedEdges.filter((edge) => {
      if (edge.count < minCount) return false;
      if (!q) return true;
      const haystack = [...edge.sources, ...edge.targets, ...edge.dates, ...edge.samplePairs, edge.sourcePlaceId, edge.targetPlaceId].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [aggregatedEdges, minCount, search]);

  const placeIdsInUse = useMemo(() => {
    const ids = new Set();
    filteredAggregatedEdges.forEach((edge) => {
      ids.add(edge.sourcePlaceId);
      ids.add(edge.targetPlaceId);
    });
    return ids;
  }, [filteredAggregatedEdges]);

  const filteredPlaces = useMemo(() => places.filter((place) => placeIdsInUse.has(place.id)), [places, placeIdsInUse]);
  const geographicGraph = useMemo(
    () => buildGraph(filteredPlaces, filteredAggregatedEdges, mapViewportSize.width, mapViewportSize.height),
    [filteredPlaces, filteredAggregatedEdges, mapViewportSize.width, mapViewportSize.height]
  );
  const personGraph = useMemo(
    () => buildPersonGraph(
      filteredRowsByTime.filter((row) => row.sourcePerson && row.targetPerson),
      mapViewportSize.width,
      mapViewportSize.height,
      personLayoutMode,
      minCount,
      search
    ),
    [filteredRowsByTime, mapViewportSize.width, mapViewportSize.height, personLayoutMode, minCount, search]
  );
  const graph = viewMode === 'geographic' ? geographicGraph : personGraph;
  const viewResetKey = useMemo(() => {
    const layoutKey = viewMode === 'person' ? `${viewMode}:${personLayoutMode}` : viewMode;
    return `${layoutKey}:${filteredRowsByTime.length}:${graph.nodes.length}:${graph.edges.length}`;
  }, [viewMode, personLayoutMode, filteredRowsByTime.length, graph.nodes.length, graph.edges.length]);

  // ------------------------------------------------------------
  // Selection and inspector derivations
  // ------------------------------------------------------------
  const selectedProps = useMemo(() => {
    return resolveSelection(selectedSelection, graph, personMetadataByName);
  }, [selectedSelection, graph, personMetadataByName]);

  const selectedLetterMetadata = useMemo(() => {
    return enrichSelectedLetters(selectedProps, personMetadataByName);
  }, [selectedProps, personMetadataByName]);

  const linkedLettersToShow = showAllLinkedLetters ? selectedLetterMetadata : selectedLetterMetadata.slice(0, 10);

  const toggleLetterSection = (letterId, section) => {
    setExpandedLetterSections((prev) => {
      const key = `${letterId}__${section}`;
      return {
        ...prev,
        [key]: !prev[key],
      };
    });
  };

  const isLetterSectionExpanded = (letterId, section) => Boolean(expandedLetterSections[`${letterId}__${section}`]);

  useEffect(() => {
    setExpandedLetterSections({});
  }, [selectedSelection?.id, selectedSelection?.kind]);

  const currentRangeLabel = timelineMonths.length && timelineMode === 'range'
    ? `${timelineMonths[Math.min(rangeStart, rangeEnd)] || '—'} to ${timelineMonths[Math.max(rangeStart, rangeEnd)] || '—'}`
    : 'All available dates';
  const currentPlaybackLabel = playbackIndex >= 0 && selectedRowsForPlayback[playbackIndex] ? selectedRowsForPlayback[playbackIndex].date : 'not running';
  const hasActivePlayback = playbackIndex >= 0 && Boolean(selectedRowsForPlayback[playbackIndex]);
  const currentPlaybackSpeedLabel = playbackSpeedOptions.find((option) => option.value === playbackSpeed)?.label || 'Slow';
  const currentMinCountLabel = minCountOptions.find((option) => option.value === minCount)?.label || String(minCount);

  // ------------------------------------------------------------
  // Diagnostics and export helpers
  // ------------------------------------------------------------
  const rowDiagnostics = useMemo(() => {
    const mappableRows = normalizedRows.filter((row) => row.mappable);
    const unknownDateRows = normalizedRows.filter((row) => !row.parsedDate?.isKnown).length;
    const timelineUsableRows = normalizedRows.filter((row) => row.parsedDate?.isTimelineUsable).length;
    const peopleInFilteredRows = Array.from(new Set(filteredRowsByTime.flatMap((row) => [row.sourcePerson, row.targetPerson]).filter(Boolean)));
    const exactPersonMetadataMatches = peopleInFilteredRows.filter((name) => personMetadataByName.has(name)).length;
    const visibleLinkedLetters = graph.edges.reduce((sum, edge) => sum + ((edge.letterMetadata || []).length), 0);

    return {
      geographyRows: geographyRows.length,
      normalizedRows: normalizedRows.length,
      mappableRows: mappableRows.length,
      unmappableRows: Math.max(0, normalizedRows.length - mappableRows.length),
      unknownDateRows,
      timelineUsableRows,
      timelineMonths: timelineMonths.length,
      filteredRows: filteredRowsByTime.length,
      routeCount: graph.edges.length,
      nodeCount: graph.nodes.length,
      linkedLetterMatches: visibleLinkedLetters,
      letterRows: normalizedLetters.length,
      personMetadataRows: normalizedPersonMetadata.length,
      exactPersonMetadataMatches,
    };
  }, [normalizedRows, filteredRowsByTime, graph.edges, graph.nodes, normalizedLetters.length, normalizedPersonMetadata.length, geographyRows.length, timelineMonths.length, personMetadataByName]);

  const exportSubtitleLines = useMemo(() => {
    return [
      `View: ${viewMode === 'geographic' ? 'Geographic routes' : 'Person network'}`,
      `Search: ${search.trim() || 'None'}`,
      `Minimum weight: ${currentMinCountLabel}`,
      `Date window: ${currentRangeLabel}`,
    ];
  }, [viewMode, search, currentMinCountLabel, currentRangeLabel]);

  const exportEdgesRows = useMemo(() => buildExportEdgeRows(graph.edges), [graph.edges]);

  const exportNodesRows = useMemo(() => buildExportNodeRows(graph.nodes), [graph.nodes]);

  const activePlaybackRow = hasActivePlayback ? selectedRowsForPlayback[playbackIndex] || null : null;
  const activeAnimationEdgeId = activePlaybackRow ? (viewMode === 'geographic' ? edgeKeyFromRow(activePlaybackRow) : `${activePlaybackRow.sourcePerson}-->${activePlaybackRow.targetPerson}`) : '';
  const activeAnimationNodeIds = useMemo(() => {
    if (!activePlaybackRow) return new Set();
    return viewMode === 'geographic'
      ? new Set([activePlaybackRow.sourcePlaceId, activePlaybackRow.targetPlaceId].filter(Boolean))
      : new Set([activePlaybackRow.sourcePerson, activePlaybackRow.targetPerson].filter(Boolean));
  }, [activePlaybackRow, viewMode]);

  const uploadSetter = (setter, setLabel) => async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await readFileText(file);
    setter(text);
    setLabel(file.name || 'Uploaded file');
  };



  const clearSelection = () => {
    setSelectedSelection(null);
    setShowAllLinkedLetters(false);
    setExpandedLetterSections({});
  };

  const triggerDownload = (blob, filename) => {
    const url = makeDownloadUrl(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => revokeObjectUrl(url), 0);

    return {
      filename,
      bytes: blob.size,
      timestamp: new Date().toLocaleTimeString(),
    };
  };

  const getMapSvgElement = () => mapViewportRef.current?.querySelector('svg') || null;

  const handleExportSvg = () => {
    try {
      const svgElement = getMapSvgElement();
      if (!svgElement) {
        setExportStatus({ kind: 'error', message: 'SVG export failed: map not found.' });
        return;
      }
      const serialized = serializeSvgForExport(svgElement, {
        title: pageTitle,
        subtitleLines: exportSubtitleLines,
      });
      const result = triggerDownload(
        new Blob([serialized.markup], { type: 'image/svg+xml;charset=utf-8' }),
        `${slugifyFilenamePart(pageTitle, 'correspondence-visualizer')}-${viewMode}-map.svg`
      );
      setExportStatus({ kind: 'success', message: 'SVG export triggered.', ...result });
    } catch (error) {
      setExportStatus({ kind: 'error', message: `SVG export failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  };

  const handleExportPng = async () => {
    try {
      const svgElement = getMapSvgElement();
      if (!svgElement) {
        setExportStatus({ kind: 'error', message: 'PNG export failed: map not found.' });
        return;
      }
      const pngBlob = await renderSvgElementToPngBlob(svgElement, {
        title: pageTitle,
        subtitleLines: exportSubtitleLines,
      });
      const result = triggerDownload(
        pngBlob,
        `${slugifyFilenamePart(pageTitle, 'correspondence-visualizer')}-${viewMode}-map.png`
      );
      setExportStatus({ kind: 'success', message: 'PNG export triggered.', ...result });
    } catch (error) {
      setExportStatus({ kind: 'error', message: `PNG export failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  };

  const handleExportEdgesCsv = () => {
    try {
      const csv = rowsToCsv(exportEdgesRows);
      const result = triggerDownload(
        new Blob([csv], { type: 'text/csv;charset=utf-8' }),
        `${slugifyFilenamePart(pageTitle, 'correspondence-visualizer')}-${viewMode}-edges.csv`
      );
      setExportStatus({ kind: 'success', message: 'Routes CSV export triggered.', ...result });
    } catch (error) {
      setExportStatus({ kind: 'error', message: `Routes CSV export failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  };

  const handleExportNodesCsv = () => {
    try {
      const csv = rowsToCsv(exportNodesRows);
      const result = triggerDownload(
        new Blob([csv], { type: 'text/csv;charset=utf-8' }),
        `${slugifyFilenamePart(pageTitle, 'correspondence-visualizer')}-${viewMode}-nodes.csv`
      );
      setExportStatus({ kind: 'success', message: 'Nodes CSV export triggered.', ...result });
    } catch (error) {
      setExportStatus({ kind: 'error', message: `Nodes CSV export failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  };

  const applyThemePreset = (presetKey) => {
    const preset = MAP_STYLE_PRESETS[presetKey];
    if (!preset) return;
    setThemePresetKey(presetKey);
    setThemeTuning((prev) => ({
      ...prev,
      ...preset,
    }));
  };

  const resetTheme = () => {
    setThemePresetKey('preModern');
    setThemeTuning(THEME_DEFAULTS);
  };

  const handleEdgeEnter = (edge, point) => {
    setHoveredEdgeId(edge.id);
    setHoverCard(buildHoverCardState(`${edge.sourceLabel} → ${edge.targetLabel}`, `Weight: ${edge.count}`, point));
  };

  const handleEdgeLeave = () => {
    setHoveredEdgeId('');
    setHoverCard(null);
  };


  const handleBlankMapClick = () => {
    setHoverCard(null);
    setHoveredEdgeId('');
    clearSelection();
  };

  const handleEdgeClick = (edge, point) => {
    setShowRightSidebar(true);
    setSelectedSelection({ kind: 'edge', id: edge.id });
    setShowAllLinkedLetters(false);
    setHoverCard(buildHoverCardState(`${edge.sourceLabel} → ${edge.targetLabel}`, `Weight: ${edge.count}`, point));
  };

  const handleNodeHover = (node, point) => {
    setHoverCard(buildHoverCardState(node.label, buildNodeHoverSummary(node, viewMode), point));
  };

  const handleNodeClick = (node, point) => {
    setShowRightSidebar(true);
    setHoverCard(buildHoverCardState(node.label, buildNodeHoverSummary(node, viewMode), point));

    setSelectedSelection({
      kind: node.isCluster ? 'cluster' : 'node',
      id: node.id,
    });
    setShowAllLinkedLetters(false);
  };


  useEffect(() => {
    const element = mapViewportRef.current;
    if (!element) return undefined;

    const updateSize = () => {
      const nextWidth = Math.max(0, Math.round(element.clientWidth || 0));
      const nextHeight = Math.max(0, Math.round(element.clientHeight || 0));
      setMapViewportSize((prev) => (
        prev.width === nextWidth && prev.height === nextHeight
          ? prev
          : { width: nextWidth, height: nextHeight }
      ));
    };

    updateSize();

    const observer = new ResizeObserver(() => updateSize());
    observer.observe(element);
    window.addEventListener('resize', updateSize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  useEffect(() => {
    if (!hoverCard) return undefined;
    const handleMove = (event) => {
      const dx = event.clientX - (hoverCard.clientX ?? 0);
      const dy = event.clientY - (hoverCard.clientY ?? 0);
      if (Math.sqrt(dx * dx + dy * dy) > 110) {
        setHoverCard(null);
        setHoveredEdgeId('');
      }
    };
    const handleDown = () => {
      setHoverCard(null);
      setHoveredEdgeId('');
        };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mousedown', handleDown);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mousedown', handleDown);
    };
  }, [hoverCard]);

  const mapStageProps = buildMapStageProps({
    mapViewportRef,
    mapViewportSize,
    graph,
    hoveredEdgeId,
    handleEdgeEnter,
    handleEdgeLeave,
    handleEdgeClick,
    handleNodeHover,
    handleNodeClick,
    showLabels,
    activeAnimationEdgeId,
    activeAnimationNodeIds,
    viewMode,
    handleBlankMapClick,
    selectedProps,
    zoomTuning,
    viewResetKey,
    hoverCard,
            });

  const leftControlPanelProps = buildLeftControlPanelProps({
    showLeftSidebar,
    setShowLeftSidebar,
    showDisplayControlsPanel,
    setShowDisplayControlsPanel,
    showTimelinePanel,
    setShowTimelinePanel,
    showExportPanel,
    setShowExportPanel,
    showSummaryPanel,
    setShowSummaryPanel,
    showThemePanel,
    setShowThemePanel,
    setGeographyCsv,
    setLettersCsv,
    setPersonMetadataCsv,
    geographyFileLabel,
    lettersFileLabel,
    personMetadataFileLabel,
    setGeographyFileLabel,
    setLettersFileLabel,
    setPersonMetadataFileLabel,
    uploadSetter,
    rowDiagnostics,
    showLabels,
    setShowLabels,
    viewMode,
    setViewMode,
    personLayoutMode,
    setPersonLayoutMode,
    search,
    setSearch,
    currentMinCountLabel,
    minCountOptions,
    minCount,
    setMinCount,
    timelineMode,
    setTimelineMode,
    currentRangeLabel,
    timelineMonths,
    rangeStart,
    setRangeStart,
    rangeEnd,
    setRangeEnd,
    currentPlaybackLabel,
    currentPlaybackSpeedLabel,
    playbackSpeedOptions,
    playbackSpeed,
    setPlaybackSpeed,
    isPlaying,
    setIsPlaying,
    playbackIndex,
    setPlaybackIndex,
    selectedRowsForPlayback,
    applyThemePreset,
    resetTheme,
    handleExportSvg,
    handleExportPng,
    handleExportEdgesCsv,
    handleExportNodesCsv,
    graph,
    exportStatus,
  });

  const rightInspectorPanelProps = buildRightInspectorPanelProps({
    showRightSidebar,
    setShowRightSidebar,
    showInspectorInfo,
    setShowInspectorInfo,
    selectedProps,
    clearSelection,
    viewMode,
    linkedLettersToShow,
    selectedLetterMetadata,
    showAllLinkedLetters,
    setShowAllLinkedLetters,
    isLetterSectionExpanded,
    toggleLetterSection,
  });

  return (
    <div className={museumShellClassName()} style={themeStyleVars}>
      <div className="relative h-full">
        <LeftControlPanel {...leftControlPanelProps} />

        <AppMainWorkspace
          pageTitle={pageTitle}
          setPageTitle={setPageTitle}
          mapStageProps={mapStageProps}
        />

        <RightInspectorPanel {...rightInspectorPanelProps} />
      </div>
    </div>
  );
}
