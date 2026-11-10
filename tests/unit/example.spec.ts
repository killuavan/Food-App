import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import ExercisesPage from '@/views/ExercisesPage.vue'
import { describe, expect, test } from 'vitest'

describe('Existing module pages', () => {
  test('keeps exercise recommendations and workout history on the exercise page', () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:pathMatch(.*)*', component: ExercisesPage }],
    })
    const wrapper = mount(ExercisesPage, { global: { plugins: [router] } })
    expect(wrapper.text()).toMatch('Recommended workouts')
    expect(wrapper.text()).toMatch('Workout history')
  })
})
