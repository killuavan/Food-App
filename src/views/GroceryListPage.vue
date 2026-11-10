<template>
  <ion-page>
    <AppNavigation />
    <ion-content>
      <main class="grocery-page">
        <header class="grocery-hero">
          <div>
            <h1>Grocery list</h1>
          </div>
          <ion-button class="add-button" :disabled="!user" @click="openCreate">
            <ion-icon slot="start" :icon="addOutline" />
            Add item
          </ion-button>
        </header>

        <ion-progress-bar v-if="loading || saving" type="indeterminate" />
        <ion-card v-if="errorMessage" class="message-card error-card">
          <ion-card-content role="alert">{{ errorMessage }}</ion-card-content>
        </ion-card>

        <section v-if="!user && !loading" class="auth-prompt">
          <h2>Sign in to manage your grocery list</h2>
          <ion-button router-link="/sign-in">Continue to sign in</ion-button>
        </section>

        <template v-else-if="user">
          <div class="summary-grid">
            <ion-card class="summary-card">
              <ion-card-content><span class="summary-icon"><ion-icon :icon="cartOutline" /></span><div><p>To buy</p><strong>{{ pendingItems.length }}</strong></div></ion-card-content>
            </ion-card>
            <ion-card class="summary-card">
              <ion-card-content><span class="summary-icon purchased-icon"><ion-icon :icon="checkmarkCircleOutline" /></span><div><p>Purchased</p><strong>{{ purchasedItems.length }}</strong></div></ion-card-content>
            </ion-card>
            <ion-card class="summary-card">
              <ion-card-content><span class="summary-icon"><ion-icon :icon="archiveOutline" /></span><div><p>Low or out of stock</p><strong>{{ restockSuggestions.length }}</strong></div></ion-card-content>
            </ion-card>
          </div>

          <section class="filter-panel" aria-label="Filter grocery list">
            <ion-searchbar
              v-model="search"
              placeholder="Search groceries"
              aria-label="Search grocery items"
              :debounce="150"
            />
            <ion-item class="filter-item">
              <ion-select v-model="categoryFilter" label="Category" interface="popover">
                <ion-select-option value="all">All categories</ion-select-option>
                <ion-select-option v-for="category in groceryCategories" :key="category" :value="category">
                  {{ category }}
                </ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item class="filter-item">
              <ion-select v-model="statusFilter" label="Status" interface="popover">
                <ion-select-option value="all">All items</ion-select-option>
                <ion-select-option value="PENDING">Pending</ion-select-option>
                <ion-select-option value="PURCHASED">Purchased</ion-select-option>
                <ion-select-option value="CANCELLED">Cancelled</ion-select-option>
              </ion-select>
            </ion-item>
            <ion-item class="filter-item">
              <ion-select v-model="sortOrder" label="Sort by" interface="popover">
                <ion-select-option value="name">Name</ion-select-option>
                <ion-select-option value="date">Date added</ion-select-option>
              </ion-select>
            </ion-item>
          </section>

          <section class="grocery-section" aria-labelledby="pending-heading">
            <div class="section-heading">
              <div><h2 id="pending-heading">Pending items</h2></div>
              <span class="item-count">{{ filteredPending.length }} items</span>
            </div>
            <ion-card v-if="filteredPending.length" class="list-card">
              <ion-list lines="none">
                <ion-item v-for="item in filteredPending" :key="item.id" class="grocery-item">
                  <span class="category-mark" slot="start" aria-hidden="true">{{ categoryIcon(item.category) }}</span>
                  <ion-label>
                    <h3>{{ item.name }}</h3>
                    <p>{{ item.category }} · Added {{ formatDate(item.createdAt) }}</p>
                    <p v-if="item.notes">{{ item.notes }}</p>
                    <p v-if="item.inventoryItemId" class="linked-note">Linked to pantry inventory</p>
                  </ion-label>
                  <strong class="quantity">{{ formatQuantity(item.quantity) }} {{ item.unit }}</strong>
                  <div class="item-actions">
                    <ion-button fill="outline" size="small" :disabled="saving" @click="markPurchased(item)">
                      <ion-icon slot="start" :icon="checkmarkOutline" /> Bought
                    </ion-button>
                    <ion-button fill="clear" size="small" :disabled="saving" @click="cancelItem(item)">Cancel</ion-button>
                    <ion-button fill="clear" size="small" :aria-label="`Edit ${item.name}`" @click="openEdit(item)">
                      <ion-icon slot="icon-only" :icon="createOutline" />
                    </ion-button>
                    <ion-button fill="clear" size="small" color="danger" :aria-label="`Delete ${item.name}`" @click="askDelete(item)">
                      <ion-icon slot="icon-only" :icon="trashOutline" />
                    </ion-button>
                  </div>
                </ion-item>
              </ion-list>
            </ion-card>
            <div v-else class="empty-card">
              <span aria-hidden="true">🛒</span>
              <h3>{{ pendingItems.length ? 'No items match these filters' : 'Your shopping list is clear' }}</h3>
              <p>{{ pendingItems.length ? 'Try another search or filter.' : 'Add an item or use one of the suggestions below.' }}</p>
              <ion-button v-if="!pendingItems.length" fill="outline" @click="openCreate">Add your first item</ion-button>
            </div>
          </section>

          <section class="grocery-section" aria-labelledby="suggestions-heading">
            <div class="section-heading">
              <div><h2 id="suggestions-heading">Suggested restocks</h2></div>
              <ion-button fill="clear" router-link="/inventory">View pantry</ion-button>
            </div>
            <ion-card v-if="restockSuggestions.length" class="suggestion-card">
              <ion-list lines="none">
                <ion-item v-for="suggestion in restockSuggestions" :key="suggestion.inventoryItem.id">
                  <span class="category-mark" slot="start" aria-hidden="true">{{ categoryIcon(suggestion.inventoryItem.category) }}</span>
                  <ion-label>
                    <h3>{{ suggestion.inventoryItem.foodName }} is {{ getStockStatus(suggestion.inventoryItem.quantity, suggestion.inventoryItem.lowStockThreshold) === 'out' ? 'out of stock' : 'running low' }}</h3>
                    <p>Available: {{ formatQuantity(suggestion.inventoryItem.quantity) }} {{ suggestion.inventoryItem.unit }} · Suggested: {{ formatQuantity(suggestion.quantity) }} {{ suggestion.unit }}</p>
                    <p v-if="suggestion.isDefault" class="notice">Default quantity: 1 {{ suggestion.unit }}. Change it before adding if needed.</p>
                    <p v-else class="notice">Suggested quantity restores the item to its saved low-stock threshold.</p>
                  </ion-label>
                  <ion-button slot="end" fill="outline" size="small" @click="openRestockSuggestion(suggestion)">
                    Add to list
                  </ion-button>
                </ion-item>
              </ion-list>
            </ion-card>
            <div v-else class="empty-inline">All inventory items are above their low-stock thresholds.</div>
          </section>

          <section class="grocery-section" aria-labelledby="meal-missing-heading">
            <div class="section-heading">
              <div><h2 id="meal-missing-heading">Ingredients to buy</h2></div>
              <ion-button fill="clear" router-link="/weekly-nutrition">View meal plan</ion-button>
            </div>
            <ion-card v-if="weeklySuggestions.length" class="suggestion-card">
              <ion-list lines="none">
                <ion-item v-for="suggestion in weeklySuggestions" :key="suggestion.name">
                  <span class="category-mark" slot="start" aria-hidden="true">{{ categoryIcon(suggestion.category) }}</span>
                  <ion-label>
                    <h3>{{ suggestion.name }}</h3>
                    <p>{{ formatQuantity(suggestion.quantity) }} {{ suggestion.unit }} · {{ suggestion.mealNames.join(', ') }}</p>
                    <p class="notice">Based on ingredient quantities in your latest saved weekly meal plan.</p>
                  </ion-label>
                  <ion-button slot="end" fill="outline" size="small" @click="addMealSuggestion(suggestion)">
                    Add to list
                  </ion-button>
                </ion-item>
              </ion-list>
            </ion-card>
            <div v-else class="empty-inline">{{ plans.length ? 'No missing ingredients with verified quantities in the latest saved plan.' : 'Save a weekly meal plan to see ingredient suggestions.' }}</div>
          </section>

          <section class="grocery-section" aria-labelledby="purchased-heading">
            <div class="section-heading">
              <div><h2 id="purchased-heading">Purchased items</h2></div>
              <span class="item-count">{{ filteredPurchased.length }} items</span>
            </div>
            <ion-card v-if="filteredPurchased.length" class="list-card">
              <ion-list lines="none">
                <ion-item v-for="item in filteredPurchased" :key="item.id" class="grocery-item">
                  <span class="category-mark purchased-mark" slot="start" aria-hidden="true"><ion-icon :icon="checkmarkCircleOutline" /></span>
                  <ion-label>
                    <h3>{{ item.name }}</h3>
                    <p>{{ formatQuantity(item.quantity) }} {{ item.unit }} · Purchased {{ formatDate(item.purchasedAt) }}</p>
                    <p v-if="item.restockedAt" class="linked-note">Added to inventory · {{ formatDate(item.restockedAt) }}</p>
                  </ion-label>
                  <div class="item-actions">
                    <ion-button v-if="!item.restockedAt" fill="outline" size="small" @click="openRestock(item)">
                      Add to inventory
                    </ion-button>
                    <ion-button v-else fill="clear" size="small" disabled>Restocked</ion-button>
                    <ion-button fill="clear" size="small" :aria-label="`Edit ${item.name}`" @click="openEdit(item)">
                      <ion-icon slot="icon-only" :icon="createOutline" />
                    </ion-button>
                    <ion-button fill="clear" size="small" color="danger" :aria-label="`Delete ${item.name}`" @click="askDelete(item)">
                      <ion-icon slot="icon-only" :icon="trashOutline" />
                    </ion-button>
                  </div>
                </ion-item>
              </ion-list>
            </ion-card>
            <div v-else class="empty-inline">No purchased items match these filters.</div>
          </section>

          <section v-if="filteredCancelled.length" class="grocery-section" aria-labelledby="cancelled-heading">
            <div class="section-heading">
              <div><h2 id="cancelled-heading">Cancelled items</h2></div>
              <span class="item-count">{{ filteredCancelled.length }} items</span>
            </div>
            <ion-card class="list-card">
              <ion-list lines="none">
                <ion-item v-for="item in filteredCancelled" :key="item.id" class="grocery-item">
                  <span class="category-mark" slot="start" aria-hidden="true">{{ categoryIcon(item.category) }}</span>
                  <ion-label><h3>{{ item.name }}</h3><p>{{ formatQuantity(item.quantity) }} {{ item.unit }} · Cancelled</p></ion-label>
                  <ion-button fill="clear" size="small" :disabled="saving" @click="restoreItem(item)">Move to pending</ion-button>
                </ion-item>
              </ion-list>
            </ion-card>
          </section>

          <section class="grocery-section" aria-labelledby="history-heading">
            <div class="section-heading">
              <div><h2 id="history-heading">Previous shopping</h2></div>
            </div>
            <ion-card v-if="historyGroups.length" class="history-card">
              <ion-accordion-group>
                <ion-accordion v-for="group in historyGroups" :key="group.date" :value="group.date">
                  <ion-item slot="header" color="light">
                    <ion-label><h3>{{ formatDate(group.date) }}</h3><p>{{ group.items.length }} completed or cancelled items</p></ion-label>
                  </ion-item>
                  <ion-list slot="content" lines="none">
                    <ion-item v-for="item in group.items" :key="item.id">
                      <ion-label><h4>{{ item.name }}</h4><p>{{ formatQuantity(item.quantity) }} {{ item.unit }} · {{ statusLabel(item.status) }}</p></ion-label>
                    </ion-item>
                  </ion-list>
                </ion-accordion>
              </ion-accordion-group>
            </ion-card>
            <div v-else class="empty-inline">Purchased and cancelled items will stay here for reference.</div>
          </section>
        </template>
      </main>

      <ion-modal :is-open="formOpen" @didDismiss="closeForm">
        <ion-header><ion-toolbar><ion-title>{{ editingItem ? 'Edit grocery item' : 'Add grocery item' }}</ion-title><ion-buttons slot="end"><ion-button @click="closeForm">Close</ion-button></ion-buttons></ion-toolbar></ion-header>
        <ion-content class="modal-content">
          <form class="grocery-form" @submit.prevent="submitForm">
            <ion-item><ion-input v-model="form.name" label="Item name" label-placement="stacked" :maxlength="200" required /></ion-item>
            <p v-if="formErrors.name" class="field-error">{{ formErrors.name }}</p>
            <ion-item><ion-select v-model="form.category" label="Category" interface="popover"><ion-select-option v-for="category in groceryCategories" :key="category" :value="category">{{ category }}</ion-select-option></ion-select></ion-item>
            <p v-if="formErrors.category" class="field-error">{{ formErrors.category }}</p>
            <ion-item>
              <ion-select v-model="form.inventoryItemId" label="Link to pantry item (optional)" interface="popover">
                <ion-select-option :value="null">No inventory link</ion-select-option>
                <ion-select-option v-for="item in inventory" :key="item.id" :value="item.id">{{ item.foodName }} · {{ formatQuantity(item.quantity) }} {{ item.unit }}</ion-select-option>
              </ion-select>
            </ion-item>
            <div class="form-quantity-row">
              <ion-item><ion-input :value="quantityInput" @ionInput="setFormQuantity" type="number" :min="0" step="any" inputmode="decimal" label="Quantity" label-placement="stacked" required /></ion-item>
              <ion-item><ion-select v-model="form.unit" label="Unit" interface="popover"><ion-select-option v-for="unit in measurementUnits" :key="unit" :value="unit">{{ unit }}</ion-select-option></ion-select></ion-item>
            </div>
            <p v-if="formErrors.quantity || formErrors.unit" class="field-error">{{ formErrors.quantity || formErrors.unit }}</p>
            <ion-item><ion-textarea v-model="form.notes" label="Notes (optional)" label-placement="stacked" :rows="3" :maxlength="500" /></ion-item>
            <ion-card v-if="form.source !== 'MANUAL'" class="source-note"><ion-card-content>{{ sourceLabel(form.source) }}</ion-card-content></ion-card>
            <ion-card v-if="formError" class="error-card"><ion-card-content role="alert">{{ formError }}</ion-card-content></ion-card>
            <ion-button expand="block" type="submit" :disabled="saving">
              <ion-spinner v-if="saving" name="crescent" />
              {{ saving ? 'Saving…' : editingItem ? 'Save changes' : 'Add to list' }}
            </ion-button>
          </form>
        </ion-content>
      </ion-modal>

      <ion-modal :is-open="Boolean(restockItem)" @didDismiss="closeRestock">
        <ion-header><ion-toolbar><ion-title>Add purchase to inventory</ion-title><ion-buttons slot="end"><ion-button @click="closeRestock">Close</ion-button></ion-buttons></ion-toolbar></ion-header>
        <ion-content class="modal-content">
          <form v-if="restockItem" class="grocery-form" @submit.prevent="submitRestock">
            <ion-card class="source-note"><ion-card-content><strong>{{ restockItem.name }}</strong><p>Confirm the actual amount purchased. Inventory changes only after you submit this form.</p></ion-card-content></ion-card>
            <ion-item><ion-select v-model="restockMode" label="Inventory action" interface="popover"><ion-select-option value="existing">Add to existing item</ion-select-option><ion-select-option value="new">Create a separate batch</ion-select-option></ion-select></ion-item>
            <ion-item v-if="restockMode === 'existing'"><ion-select v-model="restockDraft.inventoryItemId" label="Inventory item" interface="popover" required><ion-select-option v-for="item in matchingInventory" :key="item.id" :value="item.id">{{ item.foodName }} · {{ formatQuantity(item.quantity) }} {{ item.unit }}</ion-select-option></ion-select></ion-item>
            <p v-if="restockMode === 'existing' && !matchingInventory.length" class="field-error">No matching pantry item is available. Choose a separate batch.</p>
            <div class="form-quantity-row">
              <ion-item><ion-input :value="restockQuantityInput" @ionInput="setRestockQuantity" type="number" :min="0" step="any" label="Actual quantity purchased" label-placement="stacked" required /></ion-item>
              <ion-item><ion-select v-model="restockDraft.unit" label="Unit" interface="popover"><ion-select-option v-for="unit in measurementUnits" :key="unit" :value="unit">{{ unit }}</ion-select-option></ion-select></ion-item>
            </div>
            <ion-item><ion-input v-model="restockDraft.purchaseDate" type="date" label="Purchase date" label-placement="stacked" required /></ion-item>
            <ion-item v-if="restockMode === 'new'"><ion-input v-model="restockDraft.expirationDate" type="date" label="Expiration date (optional)" label-placement="stacked" /></ion-item>
            <ion-item v-if="restockMode === 'new'"><ion-input v-model="restockDraft.storageLocation" label="Storage location (optional)" label-placement="stacked" :maxlength="100" /></ion-item>
            <ion-card v-if="restockError" class="error-card"><ion-card-content role="alert">{{ restockError }}</ion-card-content></ion-card>
            <ion-button expand="block" type="submit" :disabled="saving || (restockMode === 'existing' && !restockDraft.inventoryItemId)">
              <ion-spinner v-if="saving" name="crescent" />
              {{ saving ? 'Adding to inventory…' : 'Confirm restock' }}
            </ion-button>
          </form>
        </ion-content>
      </ion-modal>

      <ion-alert
        :is-open="Boolean(duplicateTarget)"
        header="Matching pending item"
        :message="duplicateMessage"
        :buttons="duplicateButtons"
        @didDismiss="duplicateTarget = null; duplicateDraft = null"
      />
      <ion-alert
        :is-open="Boolean(deleteTarget)"
        header="Delete grocery item?"
        :message="`Delete ${deleteTarget?.name ?? 'this item'} from your list?`"
        :buttons="deleteButtons"
        @didDismiss="deleteTarget = null"
      />
      <ion-toast :is-open="toastOpen" :message="toastMessage" :color="toastColor" :duration="3200" position="bottom" @didDismiss="toastOpen = false" />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import type { AuthenticatedUser as User } from '../services/authService';
import {
  IonAccordion,
  IonAccordionGroup,
  IonAlert,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonPage,
  IonProgressBar,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToast,
  IonToolbar,
} from '@ionic/vue';
import {
  addOutline,
  archiveOutline,
  checkmarkCircleOutline,
  checkmarkOutline,
  createOutline,
  cartOutline,
  trashOutline,
} from 'ionicons/icons';
import AppNavigation from '../components/AppNavigation.vue';
import { observeAuth } from '../services/authService';
import { foodInventoryUpdatedEventName, listFoodItems } from '../services/foodInventoryService';
import { listWeeklyMealPlans } from '../services/weeklyMealPlanService';
import {
  createGroceryItem,
  deleteGroceryItem,
  groceryListUpdatedEventName,
  listGroceryItems,
  restockPurchasedGroceryItem,
  setGroceryStatus,
  updateGroceryItem,
  type GroceryRestockDraft,
} from '../services/groceryListService';
import { getLocalDate } from '../utils/foodConsumption';
import {
  addGroceryQuantities,
  filterAndSortGroceryItems,
  findMatchingPendingGrocery,
  getRestockSuggestion,
  getWeeklyMealGrocerySuggestions,
  groceryCategories,
  normalizeGroceryName,
  validateGroceryDraft,
  type GroceryCategory,
  type GroceryItem,
  type GroceryItemDraft,
  type GrocerySort,
  type GrocerySource,
  type GroceryStatus,
  type MealPlanGrocerySuggestion,
  type RestockSuggestion,
} from '../utils/groceryList';
import { measurementUnits, getStockStatus, type FoodCategory, type FoodItem } from '../utils/foodInventory';
import type { WeeklyMealPlan } from '../utils/weeklyMealRecommendations';

type RestockMode = 'existing' | 'new';

const user = ref<User | null>(null);
const inventory = ref<FoodItem[]>([]);
const items = ref<GroceryItem[]>([]);
const plans = ref<WeeklyMealPlan[]>([]);
const loading = ref(true);
const saving = ref(false);
const errorMessage = ref('');
const formError = ref('');
const restockError = ref('');
const toastMessage = ref('');
const toastColor = ref<'success' | 'danger'>('success');
const toastOpen = ref(false);
const formOpen = ref(false);
const editingItem = ref<GroceryItem | null>(null);
const restockItem = ref<GroceryItem | null>(null);
const restockMode = ref<RestockMode>('new');
const quantityInput = ref('1');
const restockQuantityInput = ref('1');
const restockDraft = reactive<GroceryRestockDraft>({
  quantity: 1,
  unit: 'pcs',
  purchaseDate: getLocalDate(),
  expirationDate: '',
  storageLocation: '',
  inventoryItemId: null,
});
const search = ref('');
const categoryFilter = ref<GroceryCategory | 'all'>('all');
const statusFilter = ref<GroceryStatus | 'all'>('all');
const sortOrder = ref<GrocerySort>('date');
const form = reactive<GroceryItemDraft>(emptyDraft());
const formErrors = ref<Record<string, string>>({});
const duplicateTarget = ref<GroceryItem | null>(null);
const duplicateDraft = ref<GroceryItemDraft | null>(null);
const deleteTarget = ref<GroceryItem | null>(null);
let unsubscribe: (() => void) | undefined;
let requestSequence = 0;

const pendingItems = computed(() => items.value.filter((item) => item.status === 'PENDING'));
const purchasedItems = computed(() => items.value.filter((item) => item.status === 'PURCHASED'));
const cancelledItems = computed(() => items.value.filter((item) => item.status === 'CANCELLED'));
const restockSuggestions = computed(() => inventory.value
  .map(getRestockSuggestion)
  .filter((suggestion): suggestion is RestockSuggestion => suggestion !== null));
const weeklySuggestions = computed(() => getWeeklyMealGrocerySuggestions(plans.value, inventory.value));
const filteredPending = computed(() => filterAndSortGroceryItems(pendingItems.value, {
  search: search.value,
  category: categoryFilter.value,
  status: statusFilter.value,
  sort: sortOrder.value,
}));
const filteredPurchased = computed(() => filterAndSortGroceryItems(purchasedItems.value, {
  search: search.value,
  category: categoryFilter.value,
  status: statusFilter.value,
  sort: sortOrder.value,
}));
const filteredCancelled = computed(() => filterAndSortGroceryItems(cancelledItems.value, {
  search: search.value,
  category: categoryFilter.value,
  status: statusFilter.value,
  sort: sortOrder.value,
}));
const historyGroups = computed(() => {
  const grouped = new Map<string, GroceryItem[]>();
  for (const item of items.value.filter((entry) => entry.status !== 'PENDING')) {
    const date = item.status === 'PURCHASED' ? item.purchasedAt?.slice(0, 10) : item.createdAt.slice(0, 10);
    if (!date) continue;
    grouped.set(date, [...(grouped.get(date) ?? []), item]);
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, historyItems]) => ({ date, items: historyItems }));
});
const matchingInventory = computed(() => {
  if (!restockItem.value) return [];
  const linked = inventory.value.find((item) => item.id === restockItem.value?.inventoryItemId);
  if (linked) return [linked];
  const normalized = normalizeGroceryName(restockItem.value.name);
  return inventory.value.filter((item) => normalizeGroceryName(item.foodName) === normalized);
});
const duplicateMessage = computed(() => duplicateTarget.value && duplicateDraft.value
  ? `${duplicateTarget.value.name} is already pending (${formatQuantity(duplicateTarget.value.quantity)} ${duplicateTarget.value.unit}). Add the new amount to it, keep a separate line, or cancel.`
  : '');

const duplicateButtons = [
  { text: 'Cancel', role: 'cancel', handler: () => { duplicateTarget.value = null; duplicateDraft.value = null; } },
  { text: 'Keep separate', handler: () => { void keepDuplicateSeparate(); } },
  { text: 'Update existing quantity', handler: () => { void mergeDuplicate(); } },
];
const deleteButtons = [
  { text: 'Cancel', role: 'cancel' },
  { text: 'Delete', role: 'destructive', handler: () => { void confirmDelete(); } },
];

onMounted(() => {
  unsubscribe = observeAuth((authenticatedUser) => {
    requestSequence += 1;
    user.value = authenticatedUser;
    items.value = [];
    inventory.value = [];
    plans.value = [];
    errorMessage.value = '';
    if (authenticatedUser) void loadData(authenticatedUser.uid);
    else loading.value = false;
  }, (error) => {
    loading.value = false;
    errorMessage.value = error.message;
  });
  window.addEventListener(groceryListUpdatedEventName, handleDataUpdated);
  window.addEventListener(foodInventoryUpdatedEventName, handleDataUpdated);
});

onUnmounted(() => {
  unsubscribe?.();
  window.removeEventListener(groceryListUpdatedEventName, handleDataUpdated);
  window.removeEventListener(foodInventoryUpdatedEventName, handleDataUpdated);
});

function emptyDraft(): GroceryItemDraft {
  return {
    shoppingListId: 'default',
    inventoryItemId: null,
    name: '',
    category: 'Others',
    quantity: 1,
    unit: 'pcs',
    source: 'MANUAL',
    notes: '',
  };
}

async function loadData(userId: string): Promise<void> {
  const sequence = ++requestSequence;
  loading.value = true;
  const results = await Promise.allSettled([
    listGroceryItems(userId),
    listFoodItems(userId),
    listWeeklyMealPlans(userId),
  ]);
  if (sequence !== requestSequence || user.value?.uid !== userId) return;
  const errors: string[] = [];
  if (results[0].status === 'fulfilled') items.value = results[0].value;
  else errors.push(results[0].reason instanceof Error ? results[0].reason.message : String(results[0].reason));
  if (results[1].status === 'fulfilled') inventory.value = results[1].value;
  else errors.push(results[1].reason instanceof Error ? results[1].reason.message : String(results[1].reason));
  if (results[2].status === 'fulfilled') plans.value = results[2].value;
  else errors.push(results[2].reason instanceof Error ? results[2].reason.message : String(results[2].reason));
  errorMessage.value = errors.join(' ');
  loading.value = false;
}

function handleDataUpdated(event: Event): void {
  const detail = (event as CustomEvent<{ userId?: string }>).detail;
  if (detail?.userId && detail.userId === user.value?.uid) void loadData(detail.userId);
}

function openCreate(): void {
  editingItem.value = null;
  Object.assign(form, emptyDraft());
  quantityInput.value = String(form.quantity);
  formError.value = '';
  formErrors.value = {};
  formOpen.value = true;
}

function openEdit(item: GroceryItem): void {
  editingItem.value = item;
  Object.assign(form, {
    shoppingListId: item.shoppingListId,
    inventoryItemId: item.inventoryItemId,
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    unit: item.unit,
    source: item.source,
    notes: item.notes,
  });
  quantityInput.value = String(item.quantity);
  formError.value = '';
  formErrors.value = {};
  formOpen.value = true;
}

function closeForm(): void {
  if (saving.value) return;
  formOpen.value = false;
  editingItem.value = null;
}

async function submitForm(): Promise<void> {
  if (!user.value) return;
  const errors = validateGroceryDraft(form);
  formErrors.value = Object.fromEntries(Object.entries(errors).filter((entry): entry is [string, string] => Boolean(entry[1])));
  if (Object.keys(formErrors.value).length) return;
  formError.value = '';
  saving.value = true;
  try {
    if (editingItem.value) {
      await updateGroceryItem(user.value.uid, editingItem.value.id, { ...form });
      formOpen.value = false;
      editingItem.value = null;
      showToast('Grocery item updated.', 'success');
      return;
    }
    const duplicate = findMatchingPendingGrocery(items.value, form);
    if (duplicate) {
      duplicateTarget.value = duplicate;
      duplicateDraft.value = { ...form };
      return;
    }
    await createGroceryItem(user.value.uid, { ...form });
    formOpen.value = false;
    showToast('Added to your grocery list.', 'success');
  } catch (error) {
    formError.value = error instanceof Error ? error.message : String(error);
  } finally {
    saving.value = false;
  }
}

async function keepDuplicateSeparate(): Promise<void> {
  if (!user.value || !duplicateDraft.value) return;
  await createFromCandidate(duplicateDraft.value);
}

async function mergeDuplicate(): Promise<void> {
  if (!user.value || !duplicateDraft.value || !duplicateTarget.value) return;
  saving.value = true;
  try {
    await updateGroceryItem(user.value.uid, duplicateTarget.value.id, {
      shoppingListId: duplicateTarget.value.shoppingListId,
      inventoryItemId: duplicateTarget.value.inventoryItemId,
      name: duplicateTarget.value.name,
      category: duplicateTarget.value.category,
      quantity: addGroceryQuantities(duplicateTarget.value.quantity, duplicateDraft.value.quantity),
      unit: duplicateTarget.value.unit,
      source: duplicateTarget.value.source,
      notes: duplicateTarget.value.notes,
    });
    duplicateTarget.value = null;
    duplicateDraft.value = null;
    formOpen.value = false;
    showToast('Existing grocery quantity updated.', 'success');
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), 'danger');
  } finally {
    saving.value = false;
  }
}

async function createFromCandidate(candidate: GroceryItemDraft): Promise<void> {
  if (!user.value) return;
  saving.value = true;
  try {
    await createGroceryItem(user.value.uid, candidate);
    duplicateTarget.value = null;
    duplicateDraft.value = null;
    formOpen.value = false;
    showToast('Added as a separate grocery item.', 'success');
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), 'danger');
  } finally {
    saving.value = false;
  }
}

function openRestockSuggestion(suggestion: RestockSuggestion): void {
  openCreateWithDraft({
    ...emptyDraft(),
    inventoryItemId: suggestion.inventoryItem.id,
    name: suggestion.inventoryItem.foodName,
    category: suggestion.inventoryItem.category,
    quantity: suggestion.quantity,
    unit: suggestion.unit,
    source: getStockStatus(suggestion.inventoryItem.quantity, suggestion.inventoryItem.lowStockThreshold) === 'out'
      ? 'OUT_OF_STOCK'
      : 'LOW_STOCK',
    notes: suggestion.isDefault ? 'Default suggestion: 1 unit. Adjust before adding.' : '',
  });
}

function addMealSuggestion(suggestion: MealPlanGrocerySuggestion): void {
  openCreateWithDraft({
    ...emptyDraft(),
    inventoryItemId: suggestion.inventoryItemId,
    name: suggestion.name,
    category: suggestion.category,
    quantity: suggestion.quantity,
    unit: suggestion.unit,
    source: 'WEEKLY_MEAL_PLAN',
    notes: `For ${suggestion.mealNames.join(', ')}.`,
  });
}

function openCreateWithDraft(draft: GroceryItemDraft): void {
  editingItem.value = null;
  Object.assign(form, draft);
  quantityInput.value = String(draft.quantity);
  formError.value = '';
  formErrors.value = {};
  formOpen.value = true;
}

async function markPurchased(item: GroceryItem): Promise<void> {
  if (!user.value) return;
  saving.value = true;
  try {
    await setGroceryStatus(user.value.uid, item.id, 'PURCHASED');
    showToast('Marked as purchased. Inventory has not changed.', 'success');
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), 'danger');
  } finally {
    saving.value = false;
  }
}

async function cancelItem(item: GroceryItem): Promise<void> {
  if (!user.value) return;
  saving.value = true;
  try {
    await setGroceryStatus(user.value.uid, item.id, 'CANCELLED');
    showToast('Item moved to cancelled.', 'success');
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), 'danger');
  } finally {
    saving.value = false;
  }
}

async function restoreItem(item: GroceryItem): Promise<void> {
  if (!user.value) return;
  saving.value = true;
  try {
    await setGroceryStatus(user.value.uid, item.id, 'PENDING');
    showToast('Item moved back to pending.', 'success');
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), 'danger');
  } finally {
    saving.value = false;
  }
}

function setFormQuantity(event: Event): void {
  const value = (event as CustomEvent<{ value?: string | number | null }>).detail?.value;
  quantityInput.value = value === null || value === undefined ? '' : String(value);
  form.quantity = value === '' || value === null || value === undefined ? Number.NaN : Number(value);
}

function setRestockQuantity(event: Event): void {
  const value = (event as CustomEvent<{ value?: string | number | null }>).detail?.value;
  restockQuantityInput.value = value === null || value === undefined ? '' : String(value);
  restockDraft.quantity = value === '' || value === null || value === undefined ? Number.NaN : Number(value);
}

function openRestock(item: GroceryItem): void {
  restockItem.value = item;
  restockError.value = '';
  restockDraft.quantity = item.quantity;
  restockQuantityInput.value = String(item.quantity);
  restockDraft.unit = item.unit;
  restockDraft.purchaseDate = getLocalDate();
  restockDraft.expirationDate = '';
  restockDraft.storageLocation = '';
  const match = inventory.value.find((entry) => entry.id === item.inventoryItemId)
    ?? inventory.value.find((entry) => normalizeGroceryName(entry.foodName) === normalizeGroceryName(item.name));
  restockMode.value = match ? 'existing' : 'new';
  restockDraft.inventoryItemId = match?.id ?? null;
}

function closeRestock(): void {
  if (saving.value) return;
  restockItem.value = null;
  restockError.value = '';
}

async function submitRestock(): Promise<void> {
  if (!user.value || !restockItem.value) return;
  if (restockMode.value === 'existing' && !restockDraft.inventoryItemId) {
    restockError.value = 'Choose an existing pantry item or create a separate batch.';
    return;
  }
  saving.value = true;
  restockError.value = '';
  try {
    const result = await restockPurchasedGroceryItem(user.value.uid, restockItem.value.id, {
      ...restockDraft,
      inventoryItemId: restockMode.value === 'existing' ? restockDraft.inventoryItemId : null,
    });
    restockItem.value = null;
    showToast('Purchase added to inventory and recorded in stock history.', 'success');
    await loadData(user.value.uid);
    if (!inventory.value.some((item) => item.id === result)) {
      showToast('Restock was saved, but inventory needs refreshing.', 'danger');
    }
  } catch (error) {
    restockError.value = error instanceof Error ? error.message : String(error);
  } finally {
    saving.value = false;
  }
}

function askDelete(item: GroceryItem): void {
  deleteTarget.value = item;
}

async function confirmDelete(): Promise<void> {
  if (!user.value || !deleteTarget.value) return;
  const item = deleteTarget.value;
  try {
    await deleteGroceryItem(user.value.uid, item.id);
    showToast(`${item.name} deleted from your grocery list.`, 'success');
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), 'danger');
  } finally {
    deleteTarget.value = null;
  }
}

function sourceLabel(source: GrocerySource): string {
  if (source === 'LOW_STOCK') return 'Suggested quantity restores this item to its saved low-stock threshold.';
  if (source === 'OUT_OF_STOCK') return 'Suggested quantity is based on the saved threshold or a clearly labeled default.';
  if (source === 'WEEKLY_MEAL_PLAN') return 'Quantity is based on ingredient amounts in your saved weekly meal plan.';
  return 'Added manually.';
}

function categoryIcon(category: FoodCategory | GroceryCategory): string {
  if (category === 'Fruits') return '🍎';
  if (category === 'Vegetables') return '🥬';
  if (category === 'Meat' || category === 'Meat and Poultry') return '🥩';
  if (category === 'Seafood' || category === 'Fish and Seafood') return '🐟';
  if (category === 'Dairy' || category === 'Eggs') return '🥛';
  if (category === 'Grains') return '🌾';
  if (category === 'Beverages') return '🧃';
  if (category === 'Snacks') return '🥨';
  if (category === 'Canned Goods' || category === 'Pantry Essentials') return '🥫';
  return '🛒';
}

function statusLabel(status: GroceryStatus): string {
  if (status === 'PURCHASED') return 'Purchased';
  if (status === 'CANCELLED') return 'Cancelled';
  return 'Pending';
}

function formatQuantity(quantity: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(quantity);
}

function formatDate(value: string | null): string {
  if (!value) return 'Date unavailable';
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

function showToast(message: string, color: 'success' | 'danger'): void {
  toastMessage.value = message;
  toastColor.value = color;
  toastOpen.value = true;
}
</script>

<style scoped>
.grocery-page { width: min(1120px, 100%); margin: 0 auto; padding: 28px 20px 112px; color: var(--app-text, #24352b); }
.grocery-hero { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin: 10px 0 24px; }
.grocery-hero h1 { margin: 0; color: #1b4332; font-size: clamp(1.7rem, 5vw, 2.45rem); letter-spacing: -.04em; }
.grocery-hero p:last-child { margin: 8px 0 0; color: #69776e; line-height: 1.55; }
.eyebrow { margin: 0 0 7px; color: #32804a; font-size: .68rem; font-weight: 800; letter-spacing: .12em; }
.add-button { --background: #2e7d32; --border-radius: 12px; --box-shadow: 0 5px 14px rgb(46 125 50 / 18%); font-weight: 700; }
.summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
.summary-card, .list-card, .suggestion-card, .history-card, .message-card { margin: 0; border: 1px solid #e8eee8; border-radius: 17px; box-shadow: 0 8px 25px rgb(25 58 38 / 5%); }
.summary-card ion-card-content { display: flex; align-items: center; gap: 11px; }
.summary-icon { display: grid; width: 40px; height: 40px; flex: 0 0 auto; place-items: center; border-radius: 13px; background: #e8f5e9; color: #2e7d32; font-size: 1.15rem; }
.purchased-icon { background: #e8f4ec; color: #2e7d32; }
.summary-card p { margin: 0 0 3px; color: #69776e; font-size: .76rem; }
.summary-card strong { color: #1b4332; font-size: 1.2rem; }
.filter-panel { display: grid; grid-template-columns: minmax(220px, 2fr) repeat(3, minmax(130px, 1fr)); gap: 10px; align-items: center; margin: 0 0 25px; padding: 12px; border: 1px solid #e9eee9; border-radius: 17px; background: #fff; box-shadow: 0 6px 20px rgb(25 58 38 / 4%); }
.filter-panel ion-searchbar { --background: #f5f8f5; --border-radius: 12px; padding: 0; }
.filter-item { --background: #f5f8f5; --border-radius: 12px; min-height: 45px; font-size: .83rem; }
.grocery-section { margin: 26px 0; }
.section-heading { display: flex; align-items: end; justify-content: space-between; gap: 14px; margin-bottom: 12px; }
.section-heading h2 { margin: 0; color: #1b4332; font-size: 1.22rem; letter-spacing: -.02em; }
.item-count { color: #758077; font-size: .8rem; }
.grocery-item { --padding-start: 13px; --inner-padding-end: 10px; --min-height: 76px; }
.category-mark { display: grid; width: 39px; height: 39px; flex: 0 0 auto; place-items: center; margin-inline-end: 10px; border-radius: 13px; background: #f0f7ef; font-size: 1.16rem; }
.purchased-mark { color: #2e7d32; }
.grocery-item h3, .suggestion-card h3 { margin: 0 0 4px; color: #27382d; font-size: .95rem; font-weight: 700; }
.grocery-item p, .suggestion-card p { margin: 3px 0 0; color: #748078; font-size: .75rem; line-height: 1.45; }
.quantity { min-width: max-content; margin: 0 8px; color: #1d5e36; font-size: .88rem; }
.item-actions { display: flex; align-items: center; justify-content: end; gap: 1px; }
.item-actions ion-button { --padding-start: 6px; --padding-end: 6px; font-size: .72rem; text-transform: none; }
.linked-note { color: #357849 !important; }
.suggestion-card ion-item { --padding-start: 12px; }
.notice { color: #778379; font-size: .71rem; }
.empty-card { display: grid; justify-items: center; padding: 28px 20px; border: 1px dashed #cfdacf; border-radius: 17px; background: #fff; text-align: center; }
.empty-card > span { font-size: 1.7rem; }
.empty-card h3 { margin: 9px 0 0; color: #294333; }
.empty-card p, .empty-inline { color: #748078; font-size: .82rem; }
.empty-inline { padding: 17px; border-radius: 14px; background: #f7faf7; }
.history-card ion-item h3 { margin: 0; font-size: .9rem; }
.history-card ion-item p { margin: 3px 0 0; color: #78827b; font-size: .75rem; }
.modal-content { --background: #f7faf7; }
.grocery-form { display: grid; gap: 11px; max-width: 650px; margin: 0 auto; padding: 20px 16px 35px; }
.grocery-form ion-item { --background: #fff; --border-radius: 12px; border: 1px solid #e5ece5; border-radius: 12px; }
.form-quantity-row { display: grid; grid-template-columns: 1fr .8fr; gap: 9px; }
.field-error { margin: -5px 5px 0; color: #ba1a1a; font-size: .78rem; }
.source-note { margin: 0; border-radius: 13px; background: #f0f7ef; box-shadow: none; }
.source-note ion-card-content { color: #45634d; font-size: .78rem; line-height: 1.5; }
.source-note p { margin: 6px 0 0; }
.grocery-form > ion-button { --background: #2e7d32; --border-radius: 12px; margin-top: 6px; font-weight: 700; }
.auth-prompt { padding: 35px 20px; text-align: center; }
.auth-prompt h2 { color: #1b4332; }
.error-card { color: #8b2020; }
@media (max-width: 740px) {
  .grocery-page { padding: 20px 14px 105px; }
  .grocery-hero { align-items: start; }
  .grocery-hero > ion-button { flex: 0 0 auto; }
  .summary-grid { gap: 7px; }
  .summary-card ion-card-content { gap: 7px; padding: 12px 9px; }
  .summary-icon { width: 33px; height: 33px; font-size: 1rem; }
  .summary-card p { font-size: .67rem; }
  .summary-card strong { font-size: 1.05rem; }
  .filter-panel { grid-template-columns: 1fr 1fr; padding: 9px; }
  .filter-panel ion-searchbar { grid-column: 1 / -1; }
  .grocery-item { flex-wrap: wrap; }
  .grocery-item ion-label { min-width: calc(100% - 65px); }
  .quantity { margin: 8px 0 7px 49px; }
  .item-actions { width: 100%; justify-content: end; margin: 4px 0 7px; }
}
@media (max-width: 420px) {
  .grocery-hero { flex-direction: column; }
  .summary-grid { grid-template-columns: 1fr 1fr; }
  .summary-card:last-child { grid-column: 1 / -1; }
  .section-heading { align-items: start; }
}
</style>
