<template>
  <div class="charts-grid">
    <section class="chart-panel">
      <h3>Daily macronutrient energy distribution</h3>
      <p v-if="!hasDistribution" class="chart-empty">No macro data available.</p>
      <div v-else class="donut-wrap">
        <canvas ref="distributionCanvas" aria-label="Macronutrient energy distribution doughnut chart" />
      </div>
      <ul class="distribution-legend">
        <li v-for="macro in distributionRows" :key="macro.name">
          <span :class="`legend-dot ${macro.color}`" />
          <span>{{ macro.name }}</span>
          <strong>{{ macro.percentage === null ? 'Not Available' : `${macro.percentage}%` }}</strong>
        </li>
      </ul>
    </section>

    <section class="chart-panel weekly-panel">
      <h3>Macronutrients by day</h3>
      <p>Gaps indicate unavailable data.</p>
      <div class="line-wrap">
        <canvas ref="weeklyCanvas" aria-label="Weekly protein carbohydrate and fat line chart" />
      </div>
      <div class="chart-legend">
        <span><i class="protein-legend" /> Protein</span>
        <span><i class="carb-legend" /> Carbohydrates</span>
        <span><i class="fat-legend" /> Fat</span>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { Chart, ArcElement, CategoryScale, DoughnutController, LinearScale, LineController, LineElement, PointElement, Tooltip, Legend } from 'chart.js';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { DailyMacronutrientSummary, WeeklyMacronutrientDay } from '../utils/dailyNutrition';

Chart.register(
  ArcElement,
  CategoryScale,
  DoughnutController,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
);

const props = defineProps<{
  summary: DailyMacronutrientSummary;
  days: WeeklyMacronutrientDay[];
}>();

const distributionCanvas = ref<HTMLCanvasElement | null>(null);
const weeklyCanvas = ref<HTMLCanvasElement | null>(null);
let distributionChart: Chart<'doughnut'> | null = null;
let weeklyChart: Chart<'line'> | null = null;

const distributionRows = computed(() => [
  { name: 'Protein', percentage: props.summary.distributionPercent.protein, color: 'protein-dot' },
  { name: 'Carbohydrates', percentage: props.summary.distributionPercent.carbohydrates, color: 'carb-dot' },
  { name: 'Fat', percentage: props.summary.distributionPercent.totalFat, color: 'fat-dot' },
]);
const hasDistribution = computed(() => distributionRows.value.some((row) => row.percentage !== null));

onMounted(() => updateCharts());
watch(() => [props.summary, props.days], updateCharts, { deep: true });
onUnmounted(() => {
  distributionChart?.destroy();
  weeklyChart?.destroy();
});

function updateCharts(): void {
  if (distributionCanvas.value) {
    distributionChart?.destroy();
    const energyValues = [
      props.summary.proteinG === null ? null : props.summary.proteinG * 4,
      props.summary.carbohydratesG === null ? null : props.summary.carbohydratesG * 4,
      props.summary.totalFatG === null ? null : props.summary.totalFatG * 9,
    ];
    const availableLabels = ['Protein', 'Carbohydrates', 'Fat'];
    const labels = availableLabels.filter((_, index) => energyValues[index] !== null);
    const data = energyValues.filter((value): value is number => value !== null);
    if (data.length) {
      distributionChart = new Chart(distributionCanvas.value, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: ['#3b8b68', '#77b96f', '#e4aa59'],
            borderColor: '#ffffff',
            borderWidth: 3,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const total = data.reduce((sum, value) => sum + value, 0);
                  const percentage = total ? (context.parsed / total) * 100 : 0;
                  return ` ${context.label}: ${percentage.toFixed(1)}% (${context.parsed.toFixed(1)} kcal macro energy)`;
                },
              },
            },
          },
        },
      });
    }
  }

  if (weeklyCanvas.value) {
    weeklyChart?.destroy();
    weeklyChart = new Chart(weeklyCanvas.value, {
      type: 'line',
      data: {
        labels: props.days.map((day) => `${day.weekday} ${day.date.slice(5)}`),
        datasets: [
          {
            label: 'Protein (g)',
            data: props.days.map((day) => day.proteinG),
            borderColor: '#3b8b68',
            backgroundColor: '#3b8b68',
            spanGaps: false,
            tension: 0.25,
          },
          {
            label: 'Carbohydrates (g)',
            data: props.days.map((day) => day.carbohydratesG),
            borderColor: '#77a951',
            backgroundColor: '#77a951',
            spanGaps: false,
            tension: 0.25,
          },
          {
            label: 'Fat (g)',
            data: props.days.map((day) => day.totalFatG),
            borderColor: '#d9983f',
            backgroundColor: '#d9983f',
            spanGaps: false,
            tension: 0.25,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Grams' } },
          x: { ticks: { maxRotation: 45, minRotation: 0 } },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              afterBody: (items) => {
                const day = props.days[items[0]?.dataIndex ?? -1];
                if (!day || day.status === 'no-records') return ['No food records; intake is unknown.'];
                if (day.status !== 'incomplete') return [];
                const datasetIndex = items[0]?.datasetIndex;
                const nutrientName = datasetIndex === 0
                  ? 'protein'
                  : datasetIndex === 1 ? 'carbohydrates' : 'totalFat';
                return [`Incomplete: ${day.entriesMissingData[nutrientName]} logged entries missing this nutrient.`];
              },
            },
          },
        },
      },
    });
  }
}
</script>

<style scoped>
.charts-grid { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); gap: 14px; }
.chart-panel { min-width: 0; padding: 16px; border: 1px solid #e4ece6; border-radius: 14px; background: #fff; }
.chart-panel h3 { margin: 0 0 8px; color: #244737; font-size: .95rem; }
.chart-panel > p { margin: 0 0 10px; color: #728078; font-size: .74rem; line-height: 1.45; }
.donut-wrap { height: 190px; }
.line-wrap { height: 240px; }
.distribution-legend { display: grid; gap: 7px; margin: 12px 0 0; padding: 0; list-style: none; }
.distribution-legend li { display: grid; grid-template-columns: 12px 1fr auto; align-items: center; gap: 8px; color: #65756a; font-size: .77rem; }
.distribution-legend strong { color: #284a39; }
.legend-dot { width: 10px; height: 10px; border-radius: 50%; }
.protein-dot, .protein-legend { background: #3b8b68; }
.carb-dot, .carb-legend { background: #77a951; }
.fat-dot, .fat-legend { background: #d9983f; }
.chart-legend { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; color: #65756a; font-size: .72rem; }
.chart-legend span { display: inline-flex; align-items: center; gap: 5px; }
.chart-legend i { width: 10px; height: 10px; border-radius: 50%; }
.chart-empty { display: grid; height: 190px; place-items: center; text-align: center; }
@media (max-width: 760px) { .charts-grid { grid-template-columns: 1fr; } }
</style>
