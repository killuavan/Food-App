<template>
  <section class="trend-panel">
    <h3>Seven-day recorded trend</h3>
    <p>Gaps indicate unavailable or non-comparable data.</p>
    <div class="chart-wrap">
      <canvas ref="canvas" :aria-label="`${nutrientLabel} seven-day trend chart`" />
    </div>
  </section>
</template>

<script setup lang="ts">
import {
  CategoryScale,
  Chart,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import { onMounted, onUnmounted, ref, watch } from 'vue';
import type { MicronutrientTrendDay } from '../utils/micronutrients';

Chart.register(CategoryScale, LineController, LineElement, LinearScale, PointElement, Tooltip);

const props = defineProps<{
  days: MicronutrientTrendDay[];
  nutrientLabel: string;
}>();

const canvas = ref<HTMLCanvasElement | null>(null);
let chart: Chart<'line'> | null = null;

onMounted(renderChart);
watch(() => [props.days, props.nutrientLabel], renderChart, { deep: true });
onUnmounted(() => chart?.destroy());

function renderChart(): void {
  if (!canvas.value) return;
  chart?.destroy();
  chart = new Chart(canvas.value, {
    type: 'line',
    data: {
      labels: props.days.map((day) => `${day.weekday} ${day.date.slice(5)}`),
      datasets: [{
        label: props.nutrientLabel,
        data: props.days.map((day) => day.amount),
        borderColor: '#398567',
        backgroundColor: '#398567',
        spanGaps: false,
        tension: 0.25,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      scales: {
        y: { beginAtZero: true, title: { display: true, text: props.days.find((day) => day.unit)?.unit ?? 'Recorded amount' } },
      },
      plugins: {
        tooltip: {
          callbacks: {
            afterBody: (items) => {
              const day = props.days[items[0]?.dataIndex ?? -1];
              if (!day || day.status === 'no-records') return ['No food records; intake is unknown.'];
              if (day.status === 'unavailable') return ['Food records exist, but this nutrient is unavailable.'];
              if (day.status === 'partial') return ['Partial or incomparable data: some foods lack this nutrient or use a different unit basis.'];
              return [];
            },
          },
        },
      },
    },
  });
}
</script>

<style scoped>
.trend-panel { padding: 16px; border: 1px solid #e4ece6; border-radius: 14px; background: #fff; }
.trend-panel h3 { margin: 0 0 6px; color: #244737; font-size: .95rem; }
.trend-panel p { margin: 0 0 10px; color: #728078; font-size: .74rem; line-height: 1.45; }
.chart-wrap { height: 245px; }
</style>
