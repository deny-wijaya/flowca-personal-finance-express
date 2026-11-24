import { randomUUID } from "node:crypto";
import { toPage, type PageRequest } from "../../../shared/domain/pagination.ts";
import { CategoryAlreadyExistsError, DEFAULT_CATEGORIES, defaultCategoryCreatedAt, type Category, type NewCategory } from "../domain/category.ts";
import type { CategoryCursor, CategoryPage, CategoryRepository } from "../domain/category-repository.ts";
import type { TransactionType } from "../domain/transaction.ts";

/** Kategori di memori untuk test. Langsung berisi kategori bawaan, sama dengan isi migration 0004. */
export class InMemoryCategoryRepository implements CategoryRepository {
  readonly #rows = new Map<string, Category>();

  constructor() {
    DEFAULT_CATEGORIES.forEach((category, index) => {
      this.#rows.set(category.id, { ...category, userId: null, createdAt: defaultCategoryCreatedAt(index) });
    });
  }

  async list(userId: string, filter: { type?: TransactionType }, page: PageRequest<CategoryCursor>): Promise<CategoryPage> {
    const after = page.after;
    const rows = [...this.#rows.values()]
      .filter((category) => isVisible(category, userId) && (!filter.type || category.type === filter.type))
      .sort(oldestFirst)
      .filter((category) => !after || oldestFirst(category, after) > 0);
    return toPage(rows.slice(0, page.limit + 1), page.limit, (category) => ({ createdAt: category.createdAt, id: category.id }));
  }

  async findById(userId: string, id: string): Promise<Category | null> {
    const row = this.#rows.get(id);
    return row && isVisible(row, userId) ? row : null;
  }

  async create(userId: string, input: NewCategory): Promise<Category> {
    const taken = [...this.#rows.values()].some(
      (category) => isVisible(category, userId) && category.type === input.type && category.name.toLowerCase() === input.name.toLowerCase(),
    );
    if (taken) throw new CategoryAlreadyExistsError(input.name);
    const category: Category = { ...input, id: `cat_${randomUUID()}`, userId, createdAt: new Date() };
    this.#rows.set(category.id, category);
    return category;
  }

  /** Nama kategori untuk InMemoryTransactionRepository, yang meniru JOIN di Postgres. */
  nameOf(id: string): string {
    return this.#rows.get(id)?.name ?? "";
  }
}

function isVisible(category: Category, userId: string): boolean {
  return category.userId === null || category.userId === userId;
}

function oldestFirst(a: Pick<Category, "createdAt" | "id">, b: Pick<Category, "createdAt" | "id">): number {
  return a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
