# Uncle Joe's Kitchen — API 接口契约

> 本文档是前后端对接的唯一标准，前端（Gemini）和后端（Claude Code）都必须严格遵守
> Base URL: `http://localhost:3000/api`
> 认证方式: Bearer Token（JWT）in Authorization header

---

## 通用约定

### 请求头
```
Content-Type: application/json
Authorization: Bearer <token>   // 除登录外所有接口
```

### 统一响应格式
```typescript
// 成功
interface ApiResponse<T> {
  code: number;       // 200
  message: string;    // "success"
  data: T;
  timestamp: string;  // ISO 8601
}

// 分页
interface PaginatedResponse<T> {
  code: number;
  message: string;
  data: {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  timestamp: string;
}

// 错误
interface ErrorResponse {
  code: number;       // 400/401/403/404/500
  message: string;
  errors?: { field: string; message: string }[];
  timestamp: string;
}
```

### 通用分页参数
```
?page=1&pageSize=20&sortBy=createdAt&sortOrder=desc
```

---

## 1. 认证模块

### POST /auth/wx-login
微信小程序登录

**Request:**
```json
{
  "code": "wx_login_code_from_wx.login()"
}
```

**Response:**
```json
{
  "code": 200,
  "data": {
    "token": "eyJhbGciOi...",
    "user": {
      "id": "uuid",
      "nickname": "厨神",
      "avatarUrl": null,
      "role": "user",
      "points": 0
    },
    "isNewUser": true
  }
}
```

### GET /auth/profile
获取当前用户信息（需登录）

**Response:**
```json
{
  "code": 200,
  "data": {
    "id": "uuid",
    "nickname": "厨神小明",
    "avatarUrl": "https://...",
    "phone": null,
    "role": "user",
    "points": 20,
    "stats": {
      "recipeCount": 23,
      "cookingCount": 156,
      "favoriteCount": 45
    },
    "createdAt": "2026-05-01T00:00:00Z"
  }
}
```

### PUT /auth/profile
更新个人信息

**Request:**
```json
{
  "nickname": "新名字",
  "avatarUrl": "https://..."
}
```

---

## 2. 菜谱模块

### POST /recipes
创建菜谱

**Request:**
```json
{
  "title": "糖醋排骨",
  "description": "家传秘方",
  "coverImageUrl": "https://...",
  "baseServings": 1,
  "servingUnit": "份",
  "difficulty": "medium",
  "cookTime": "30-60min",
  "mealScene": "dinner",
  "tags": ["家常菜", "下饭"],
  "isPublic": false,
  "cookingTips": "排骨要先焯水",
  "categoryIds": [1, 3],
  "ingredients": [
    {
      "ingredientId": 12,
      "customName": null,
      "groupName": "主料",
      "amount": 500,
      "unit": "g",
      "scaleType": "linear",
      "scaleFactor": 1.0,
      "sortOrder": 0,
      "note": "切小块"
    },
    {
      "ingredientId": null,
      "customName": "冰糖",
      "groupName": "调料",
      "amount": 30,
      "unit": "g",
      "scaleType": "sub_linear",
      "scaleFactor": 0.7,
      "sortOrder": 1,
      "note": null
    }
  ],
  "steps": [
    {
      "stepNumber": 1,
      "description": "排骨冷水下锅焯水，捞出洗净",
      "images": [],
      "timerSeconds": 300,
      "timerLabel": "焯水",
      "timerType": "countdown",
      "temperature": null,
      "parallelGroup": null
    },
    {
      "stepNumber": 2,
      "description": "热锅凉油，放入{冰糖}炒至融化起泡",
      "images": ["https://..."],
      "timerSeconds": null,
      "timerLabel": null,
      "timerType": null,
      "temperature": null,
      "parallelGroup": null
    }
  ]
}
```

**Response:**
```json
{
  "code": 200,
  "data": {
    "id": "recipe-uuid",
    "version": 1,
    "createdAt": "2026-05-25T12:00:00Z"
  }
}
```

### GET /recipes
菜谱列表

**Query Params:**
```
?page=1
&pageSize=20
&keyword=排骨              // 搜索标题/描述/标签
&categoryId=1             // 分类筛选
&difficulty=medium        // 难度筛选
&mealScene=dinner         // 场景筛选
&isPublic=true            // 公开菜谱（发现页用）
&userId=uuid              // 指定用户的菜谱
&sortBy=createdAt         // createdAt/updatedAt/viewCount/favoriteCount
&sortOrder=desc
```

**Response:**
```json
{
  "code": 200,
  "data": {
    "items": [
      {
        "id": "recipe-uuid",
        "title": "糖醋排骨",
        "coverImageUrl": "https://...",
        "difficulty": "medium",
        "cookTime": "30-60min",
        "tags": ["家常菜", "下饭"],
        "isPublic": true,
        "viewCount": 128,
        "favoriteCount": 23,
        "ratingAvg": 4.5,
        "estimatedCost": 25.50,
        "author": {
          "id": "user-uuid",
          "nickname": "厨神小明",
          "avatarUrl": "https://..."
        },
        "createdAt": "2026-05-25T12:00:00Z"
      }
    ],
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "totalPages": 5
  }
}
```

### GET /recipes/:id
菜谱详情（含用料、步骤）

**Response:**
```json
{
  "code": 200,
  "data": {
    "id": "recipe-uuid",
    "title": "糖醋排骨",
    "description": "家传秘方",
    "coverImageUrl": "https://...",
    "baseServings": 1,
    "servingUnit": "份",
    "difficulty": "medium",
    "cookTime": "30-60min",
    "mealScene": "dinner",
    "tags": ["家常菜", "下饭"],
    "isPublic": false,
    "version": 3,
    "viewCount": 128,
    "favoriteCount": 23,
    "ratingAvg": 4.5,
    "cookingTips": "排骨要先焯水",
    "categories": [
      { "id": 1, "name": "中餐" }
    ],
    "ingredients": [
      {
        "id": 1,
        "ingredientId": 12,
        "name": "排骨",
        "groupName": "主料",
        "amount": 500,
        "unit": "g",
        "scaleType": "linear",
        "scaleFactor": 1.0,
        "sortOrder": 0,
        "note": "切小块",
        "unitPrice": 0.04
      },
      {
        "id": 2,
        "ingredientId": null,
        "name": "冰糖",
        "groupName": "调料",
        "amount": 30,
        "unit": "g",
        "scaleType": "sub_linear",
        "scaleFactor": 0.7,
        "sortOrder": 1,
        "note": null,
        "unitPrice": 0.015
      }
    ],
    "steps": [
      {
        "id": 1,
        "stepNumber": 1,
        "description": "排骨冷水下锅焯水，捞出洗净",
        "images": [],
        "timerSeconds": 300,
        "timerLabel": "焯水",
        "timerType": "countdown",
        "temperature": null,
        "parallelGroup": null
      }
    ],
    "estimatedCost": 25.50,
    "author": {
      "id": "user-uuid",
      "nickname": "厨神小明",
      "avatarUrl": "https://..."
    },
    "isFavorited": false,
    "createdAt": "2026-05-25T12:00:00Z",
    "updatedAt": "2026-05-25T14:00:00Z"
  }
}
```

### PUT /recipes/:id
更新菜谱（自动创建新版本）

**Request:** 同 POST /recipes 格式

### DELETE /recipes/:id

### GET /recipes/:id/versions
版本历史

**Response:**
```json
{
  "code": 200,
  "data": [
    { "version": 3, "changeSummary": "调整调料比例", "createdAt": "2026-05-25T14:00:00Z" },
    { "version": 2, "changeSummary": "添加步骤图片", "createdAt": "2026-05-24T10:00:00Z" },
    { "version": 1, "changeSummary": "初始版本", "createdAt": "2026-05-23T08:00:00Z" }
  ]
}
```

### POST /recipes/:id/versions/:version/rollback
回滚到指定版本

---

## 3. SOP 执行模块

### POST /cooking/start
开始烹饪

**Request:**
```json
{
  "recipeId": "recipe-uuid",
  "targetServings": 5
}
```

**Response:**
```json
{
  "code": 200,
  "data": {
    "cookingLogId": "log-uuid",
    "multiplier": 5.0,
    "scaledIngredients": [
      {
        "name": "排骨",
        "originalAmount": 500,
        "scaledAmount": 2500,
        "unit": "g",
        "scaleType": "linear",
        "lineCost": 100.00
      },
      {
        "name": "冰糖",
        "originalAmount": 30,
        "scaledAmount": 93.3,
        "unit": "g",
        "scaleType": "sub_linear",
        "lineCost": 1.40
      }
    ],
    "totalCost": 127.50,
    "costPerServing": 25.50
  }
}
```

### PUT /cooking/:logId/complete
完成烹饪

**Request:**
```json
{
  "rating": 5,
  "notes": "这次做得不错，下次盐可以少放一点"
}
```

### GET /cooking/history
烹饪历史

**Query:** `?page=1&pageSize=20&recipeId=uuid`

**Response:**
```json
{
  "code": 200,
  "data": {
    "items": [
      {
        "id": "log-uuid",
        "recipe": { "id": "recipe-uuid", "title": "糖醋排骨", "coverImageUrl": "..." },
        "targetServings": 5,
        "servingUnit": "份",
        "totalCost": 127.50,
        "rating": 5,
        "notes": "...",
        "startedAt": "2026-05-25T18:00:00Z",
        "completedAt": "2026-05-25T19:00:00Z"
      }
    ],
    "total": 10,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  }
}
```

---

## 4. 计时器模块

### POST /timers
创建计时器

**Request:**
```json
{
  "label": "面团发酵",
  "totalSeconds": 1800,
  "type": "countdown",
  "recipeId": "recipe-uuid",
  "stepId": 3
}
```

**Response:**
```json
{
  "code": 200,
  "data": {
    "id": "timer-uuid",
    "label": "面团发酵",
    "totalSeconds": 1800,
    "remainingSeconds": 1800,
    "status": "running",
    "type": "countdown",
    "startedAt": "2026-05-25T18:00:00Z"
  }
}
```

### GET /timers
获取当前活跃计时器

**Response:**
```json
{
  "code": 200,
  "data": [
    {
      "id": "timer-1",
      "label": "面团发酵",
      "totalSeconds": 1800,
      "remainingSeconds": 1200,
      "status": "running",
      "type": "countdown",
      "startedAt": "2026-05-25T18:00:00Z"
    },
    {
      "id": "timer-2",
      "label": "烤箱预热",
      "totalSeconds": 600,
      "remainingSeconds": 600,
      "status": "paused",
      "type": "countdown",
      "pausedAt": "2026-05-25T18:02:00Z"
    }
  ]
}
```

### PUT /timers/:id/pause
### PUT /timers/:id/resume
### DELETE /timers/:id

---

## 5. 食材库模块

### GET /ingredients
搜索公共食材库

**Query:** `?keyword=排骨&categoryId=3&page=1&pageSize=20`

**Response:**
```json
{
  "code": 200,
  "data": {
    "items": [
      {
        "id": 12,
        "name": "排骨",
        "categoryId": 3,
        "categoryName": "肉禽",
        "defaultUnit": "g",
        "referencePrice": 0.04,
        "aliases": "猪排骨,肋排"
      }
    ]
  }
}
```

### GET /user-ingredients
个人食材库

### POST /user-ingredients
添加个人食材/单价

**Request:**
```json
{
  "ingredientId": 12,
  "customName": null,
  "unitPrice": 0.036,
  "priceUnit": "g",
  "supplier": "永辉超市"
}
```

### PUT /user-ingredients/:id
### DELETE /user-ingredients/:id

---

## 6. 分类模块

### GET /categories
获取分类列表

**Query:** `?type=recipe`  (recipe/ingredient/meal_scene)

**Response:**
```json
{
  "code": 200,
  "data": [
    { "id": 1, "name": "中餐", "type": "recipe", "parentId": null, "icon": "🥘", "sortOrder": 0 },
    { "id": 2, "name": "西餐", "type": "recipe", "parentId": null, "icon": "🍝", "sortOrder": 1 }
  ]
}
```

---

## 7. 收藏模块

### POST /favorites
添加收藏

**Request:**
```json
{ "recipeId": "recipe-uuid", "folder": "默认收藏夹" }
```

### DELETE /favorites/:recipeId
取消收藏

### GET /favorites
我的收藏列表

---

## 8. 文件上传

### POST /upload/image
上传图片

**Request:** `multipart/form-data`, field name: `file`

**Response:**
```json
{
  "code": 200,
  "data": {
    "url": "https://storage.unclejoes.kitchen/images/xxx.jpg",
    "width": 800,
    "height": 600
  }
}
```

限制：5MB，jpg/png/webp

---

## 9. 管理后台接口

所有 admin 接口需要 role=admin 的 JWT。

### GET /admin/dashboard
### GET /admin/users?page=1&keyword=xxx
### PUT /admin/users/:id/role  `{ "role": "vip" }`
### GET /admin/recipes?page=1&status=published
### PUT /admin/recipes/:id/feature  `{ "isFeatured": true }`
### CRUD /admin/categories
### CRUD /admin/ingredients
### GET /admin/configs
### PUT /admin/configs/:key  `{ "value": {...} }`
