// Categories API — /categories endpoints (US28).
import { apiRequest } from './client';

export interface CategoryResponse {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CategoryListResponse {
  categories: CategoryResponse[];
}

export interface CategoryCreate {
  name: string;
  description?: string;
}

export const categoriesApi = {
  list: () =>
    apiRequest<CategoryListResponse>('GET', '/categories'),

  create: (data: CategoryCreate) =>
    apiRequest<CategoryResponse>('POST', '/categories', data),

  remove: (categoryId: string) =>
    apiRequest<{ message: string }>('DELETE', `/categories/${categoryId}`),
};
