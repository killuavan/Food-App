<template>
  <div class="chart-wrap">
    <canvas ref="canvas" :aria-label="label" role="img" />
  </div>
</template>

<script setup lang="ts">
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import { onMounted, onUnmounted, ref, watch } from 'vue';

Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
);

const props = defineProps<{
  type: 'bar' | 'doughnut' | 'line';
  label: string;
  labels: string[];
  datasets: Array<{
    label: string;
    data: Array<number | null>;
    color: string;
  }>;
  axisTitle?: string;
  horizontal?: boolean;
}>();

const canvas = ref<HTMLCanvasElement | null>(null);
let chart: Chart | null = null;
onMounted(renderChart);
watch(() => [props.type, props.labels, props.datasets, props.axisTitle, props.horizontal], renderChart, { deep: true });
onUnmounted(() => chart?.destroy());

function renderChart(): void {
  if (!canvas.value) return;
  chart?.destroy();
  chart = new Chart(canvas.value, {
    type: props.type,
    data: {
      labels: props.labels,
      datasets: props.datasets.map((dataset) => ({
        label: dataset.label,
        data: dataset.data,
        borderColor: dataset.color,
        backgroundColor: props.type === 'doughnut'
          ? ['#398567', '#84b875', '#e3a652', '#8092b0', '#ba7d89']
          : props.type === 'bar' ? `${dataset.color}cc` : dataset.color,
        borderWidth: 2,
        tension: 0.25,
        spanGaps: false,
        ...(props.type === 'doughnut' ? { borderColor: '#ffffff', borderWidth: 3 } : {}),
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: props.horizontal ? 'y' : 'x',
      interaction: { intersect: false, mode: 'index' },
      scales: props.type === 'doughnut' ? undefined : props.horizontal ? {
        x: { beginAtZero: true, title: { display: Boolean(props.axisTitle), text: props.axisTitle } },
        y: { ticks: { autoSkip: false } },
      } : {
        y: { beginAtZero: true, title: { display: Boolean(props.axisTitle), text: props.axisTitle } },
        x: { ticks: { maxRotation: 45, minRotation: 0, autoSkip: true } },
      },
      plugins: {
        legend: { display: props.datasets.length > 1 || props.type === 'doughnut', position: 'bottom' },
      },
    },
  });
}
</script>

<style scoped>
.chart-wrap { position: relative; width: 100%; height: 250px; }
@media (max-width: 560px) { .chart-wrap { height: 220px; } }
</style>
