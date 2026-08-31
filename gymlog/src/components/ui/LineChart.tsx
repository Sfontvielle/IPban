import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { Txt } from '@/components/ui/Txt';
import { usePalette } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { formatDateRu } from '@/utils/date';

export interface ChartPoint {
  x: number;
  y: number;
}

interface Props {
  data: ChartPoint[];
  height?: number;
  width: number;
  formatValue?: (value: number) => string;
  emptyText?: string;
}

/**
 * Небольшой линейный график на react-native-svg.
 * Своя реализация вместо тяжёлой библиотеки: полная совместимость с Expo Go
 * и полный контроль над темой.
 */
export function LineChart({
  data,
  height = 180,
  width,
  formatValue = (value) => String(Math.round(value)),
  emptyText = 'Пока нет данных',
}: Props) {
  const palette = usePalette();

  const geometry = useMemo(() => {
    if (data.length === 0) return null;

    const padLeft = 44;
    const padRight = 12;
    const padTop = 14;
    const padBottom = 24;
    const innerWidth = Math.max(1, width - padLeft - padRight);
    const innerHeight = Math.max(1, height - padTop - padBottom);

    const xs = data.map((p) => p.x);
    const ys = data.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const rawMin = Math.min(...ys);
    const rawMax = Math.max(...ys);
    const pad = rawMax === rawMin ? Math.max(1, rawMax * 0.05) : (rawMax - rawMin) * 0.15;
    const minY = Math.max(0, rawMin - pad);
    const maxY = rawMax + pad;

    const scaleX = (x: number) =>
      padLeft + (maxX === minX ? innerWidth / 2 : ((x - minX) / (maxX - minX)) * innerWidth);
    const scaleY = (y: number) =>
      padTop + innerHeight - (maxY === minY ? innerHeight / 2 : ((y - minY) / (maxY - minY)) * innerHeight);

    const points = data.map((p) => ({ x: scaleX(p.x), y: scaleY(p.y), raw: p }));
    const path = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
      .join(' ');
    const area = `${path} L${points[points.length - 1].x.toFixed(1)},${(padTop + innerHeight).toFixed(1)} L${points[0].x.toFixed(1)},${(padTop + innerHeight).toFixed(1)} Z`;

    const gridValues = [maxY, (maxY + minY) / 2, minY];

    return { points, path, area, gridValues, scaleY, padLeft, padTop, innerWidth, innerHeight, minX, maxX };
  }, [data, height, width]);

  if (!geometry) {
    return (
      <View style={[styles.empty, { height }]}>
        <Txt tone="faint" variant="small">{emptyText}</Txt>
      </View>
    );
  }

  const last = geometry.points[geometry.points.length - 1];

  return (
    <View>
      <Svg width={width} height={height}>
        {geometry.gridValues.map((value) => (
          <React.Fragment key={value}>
            <Line
              x1={geometry.padLeft}
              y1={geometry.scaleY(value)}
              x2={width - 12}
              y2={geometry.scaleY(value)}
              stroke={palette.line}
              strokeWidth={1}
            />
            <SvgText
              x={geometry.padLeft - 6}
              y={geometry.scaleY(value) + 4}
              fill={palette.inkFaint}
              fontSize={10}
              textAnchor="end"
            >
              {formatValue(value)}
            </SvgText>
          </React.Fragment>
        ))}

        <Path d={geometry.area} fill={palette.accent} opacity={0.1} />
        <Path d={geometry.path} stroke={palette.accent} strokeWidth={2.5} fill="none" />

        {geometry.points.map((point, index) => (
          <Circle
            key={`${point.raw.x}-${index}`}
            cx={point.x}
            cy={point.y}
            r={index === geometry.points.length - 1 ? 5 : 3}
            fill={index === geometry.points.length - 1 ? palette.accent : palette.surface}
            stroke={palette.accent}
            strokeWidth={2}
          />
        ))}

        <SvgText x={geometry.padLeft} y={height - 6} fill={palette.inkFaint} fontSize={10}>
          {formatDateRu(geometry.minX)}
        </SvgText>
        <SvgText x={width - 12} y={height - 6} fill={palette.inkFaint} fontSize={10} textAnchor="end">
          {formatDateRu(geometry.maxX)}
        </SvgText>
      </Svg>

      <View style={styles.lastValue}>
        <Txt variant="caption" tone="muted">Последнее значение</Txt>
        <Txt variant="body" weight="600" tabular>{formatValue(last.raw.y)}</Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  lastValue: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
});
