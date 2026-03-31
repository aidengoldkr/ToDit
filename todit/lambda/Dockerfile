FROM public.ecr.aws/lambda/nodejs:20

# pdf-parse(canvas) + @google-cloud/vision(gRPC) 시스템 라이브러리
RUN dnf install -y \
    cairo-devel libjpeg-turbo-devel pango-devel giflib-devel \
    python3 make gcc gcc-c++ \
    && dnf clean all

WORKDIR ${LAMBDA_TASK_ROOT}

COPY lambda/package.json lambda/package-lock.json ./
RUN npm ci

COPY lambda/parse/index.ts ./parse/
COPY lambda/tsconfig.json  ./

# src/lib/*.ts → ./lib/ 으로 복사 (심볼릭 링크 대신)
COPY src/lib/openai.ts             ./lib/
COPY src/lib/google-ocr.ts         ./lib/
COPY src/lib/schema.ts             ./lib/
COPY src/lib/usage.ts              ./lib/
COPY src/lib/subscription.ts       ./lib/
COPY src/lib/consent.ts            ./lib/
COPY src/lib/plan-policy.ts        ./lib/
COPY src/lib/validators.ts         ./lib/
COPY src/lib/supabase/admin.ts     ./lib/supabase/
COPY src/lib/supabase/storage.ts   ./lib/supabase/
COPY src/types/index.ts            ./types/

RUN npx esbuild parse/index.ts \
    --bundle \
    --platform=node \
    --target=node20 \
    --outfile=dist/index.js \
    --external:@aws-sdk \
    --alias:@/lib=./lib \
    --alias:@/types=./types/index

RUN npm prune --omit=dev

CMD ["dist/index.handler"]
