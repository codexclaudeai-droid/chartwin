import { assertAdminActor, type Actor } from '../../domain/chart-service/index.ts';
import type { AsyncChartServiceRepository } from './async-repository.ts';
import type { ChartServiceRepository, PublicBoardCategory, PublicBoardPostRecord } from './repository.ts';

type PublicBoardPostInput = {
  id?: string;
  category: PublicBoardCategory;
  title: string;
  body: string;
  isPublished: boolean;
  sortOrder: number;
};

type PublicBoardPostsUpdateInput = {
  admin: Actor;
  posts: PublicBoardPostInput[];
  updatedAt: string;
};

export const PUBLIC_BOARD_CATEGORY_LABELS = {
  notice: '공지사항',
  qna: '질문답변',
  faq: 'FAQ',
} satisfies Record<PublicBoardPostRecord['category'], string>;

export function getDefaultPublicBoardPosts(): PublicBoardPostRecord[] {
  return [
    {
      id: 'public_board_notice',
      category: 'notice',
      title: '서비스 운영 공지',
      body: '구독 운영, 결제 안내, 차트 접근 정책 변경 사항을 공개 게시판으로 안내합니다.',
      isPublished: true,
      sortOrder: 10,
      createdAt: '2026-05-23T00:00:00.000Z',
      updatedAt: '2026-05-23T00:00:00.000Z',
      updatedByAdminId: 'admin_1',
    },
    {
      id: 'public_board_qna',
      category: 'qna',
      title: '공개 질문답변',
      body: '자주 반복되는 질문은 공개 답변으로 정리하고, 개인정보가 필요한 내용은 1:1 문의로 처리합니다.',
      isPublished: true,
      sortOrder: 20,
      createdAt: '2026-05-23T00:00:00.000Z',
      updatedAt: '2026-05-23T00:00:00.000Z',
      updatedByAdminId: 'admin_1',
    },
    {
      id: 'public_board_faq',
      category: 'faq',
      title: '자주 묻는 질문',
      body: '결제, 승인, 무료체험, 시그널 접근 기준을 가장 앞에서 확인할 수 있게 정리합니다.',
      isPublished: true,
      sortOrder: 30,
      createdAt: '2026-05-23T00:00:00.000Z',
      updatedAt: '2026-05-23T00:00:00.000Z',
      updatedByAdminId: 'admin_1',
    },
  ];
}

export function listPublishedPublicBoardPosts(
  repository: Pick<ChartServiceRepository, 'listPublicBoardPosts'>,
): PublicBoardPostRecord[] {
  return repository.listPublicBoardPosts()
    .filter((post) => post.isPublished)
    .sort((left, right) => (
      left.sortOrder - right.sortOrder ||
      right.updatedAt.localeCompare(left.updatedAt) ||
      left.title.localeCompare(right.title)
    ))
    .map((post) => structuredClone(post));
}

export async function listAsyncPublishedPublicBoardPosts(
  repository: Pick<AsyncChartServiceRepository, 'listPublicBoardPosts'>,
): Promise<PublicBoardPostRecord[]> {
  return (await repository.listPublicBoardPosts())
    .filter((post) => post.isPublished)
    .sort((left, right) => (
      left.sortOrder - right.sortOrder ||
      right.updatedAt.localeCompare(left.updatedAt) ||
      left.title.localeCompare(right.title)
    ))
    .map((post) => structuredClone(post));
}

export function updatePublicBoardPosts(
  repository: Pick<ChartServiceRepository, 'appendAuditLog' | 'listPublicBoardPosts' | 'nextId' | 'savePublicBoardPost'>,
  input: PublicBoardPostsUpdateInput,
): PublicBoardPostRecord[] {
  assertAdminActor(input.admin);
  const before = repository.listPublicBoardPosts();
  const updatedPosts = createPublicBoardPostRecords(repository, input, before);

  updatedPosts.forEach((post) => repository.savePublicBoardPost(post));
  const after = repository.listPublicBoardPosts();
  repository.appendAuditLog({
    actorAdminId: input.admin.id,
    action: 'admin.public_board.update',
    targetType: 'public_board_posts',
    targetId: 'all',
    beforeJson: { posts: before },
    afterJson: { posts: after },
  });

  return updatedPosts;
}

export async function updateAsyncPublicBoardPosts(
  repository: Pick<AsyncChartServiceRepository, 'appendAuditLog' | 'listPublicBoardPosts' | 'nextId' | 'savePublicBoardPost'>,
  input: PublicBoardPostsUpdateInput,
): Promise<PublicBoardPostRecord[]> {
  assertAdminActor(input.admin);
  const before = await repository.listPublicBoardPosts();
  const updatedPosts = await createAsyncPublicBoardPostRecords(repository, input, before);

  await Promise.all(updatedPosts.map((post) => repository.savePublicBoardPost(post)));
  const after = await repository.listPublicBoardPosts();
  await repository.appendAuditLog({
    actorAdminId: input.admin.id,
    action: 'admin.public_board.update',
    targetType: 'public_board_posts',
    targetId: 'all',
    beforeJson: { posts: before },
    afterJson: { posts: after },
  });

  return updatedPosts;
}

function createPublicBoardPostRecords(
  repository: Pick<ChartServiceRepository, 'nextId'>,
  input: PublicBoardPostsUpdateInput,
  existingPosts: PublicBoardPostRecord[],
): PublicBoardPostRecord[] {
  return input.posts.map((post) => createPublicBoardPostRecord({
    post,
    existingPost: existingPosts.find((item) => item.id === post.id),
    id: post.id || repository.nextId('public_board'),
    updatedAt: input.updatedAt,
    updatedByAdminId: input.admin.id,
  }));
}

async function createAsyncPublicBoardPostRecords(
  repository: Pick<AsyncChartServiceRepository, 'nextId'>,
  input: PublicBoardPostsUpdateInput,
  existingPosts: PublicBoardPostRecord[],
): Promise<PublicBoardPostRecord[]> {
  return Promise.all(input.posts.map(async (post) => createPublicBoardPostRecord({
    post,
    existingPost: existingPosts.find((item) => item.id === post.id),
    id: post.id || await repository.nextId('public_board'),
    updatedAt: input.updatedAt,
    updatedByAdminId: input.admin.id,
  })));
}

function createPublicBoardPostRecord(input: {
  post: PublicBoardPostInput;
  existingPost?: PublicBoardPostRecord;
  id: string;
  updatedAt: string;
  updatedByAdminId: string;
}): PublicBoardPostRecord {
  const title = input.post.title.trim();
  const body = input.post.body.trim();
  if (!title) throw new Error('Public board title is required');
  if (!body) throw new Error('Public board body is required');

  return {
    id: input.id,
    category: input.post.category,
    title,
    body,
    isPublished: input.post.isPublished,
    sortOrder: Number.isFinite(input.post.sortOrder) ? input.post.sortOrder : 0,
    createdAt: input.existingPost?.createdAt ?? input.updatedAt,
    updatedAt: input.updatedAt,
    updatedByAdminId: input.updatedByAdminId,
  };
}
