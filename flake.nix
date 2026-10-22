{
  description = "VoiceHub - 校园广播站点歌管理系统";

  nixConfig = {
    extra-substituters = [ "https://voicehub.cachix.org" ];
    extra-trusted-public-keys = [ "voicehub.cachix.org-1:CKw4/RvZy5c0WVpyo5ZyLbJgdpHZ/+epofIwGOeIOhU=" ];
  };

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    { self
    , nixpkgs
    , flake-utils
    }:
    flake-utils.lib.eachDefaultSystem
      (
        system:
        let
          pkgs = import nixpkgs { inherit system; };

          pnpm = pkgs.pnpm_10.override {
            version = "10.29.3";
            hash = "sha256-p09NvT9afKh00AQTUnHwtpe2g78f0vwhM5YRYc0lspw=";
          };

          version = (builtins.fromJSON (builtins.readFile ./package.json)).version;

          voicehub = pkgs.stdenv.mkDerivation (finalAttrs: {
            pname = "voicehub";
            inherit version;

            src = self;

            pnpmDeps = pkgs.fetchPnpmDeps {
              inherit (finalAttrs) pname version src;
              inherit pnpm;
              fetcherVersion = 4;
              hash = "sha256-cNbcXIJ8RHZ32pEWSJazma1ig16gG9+TEnOk8zh/HtU=";
            };

            nativeBuildInputs = [
              pkgs.nodejs_24
              pkgs.pnpmConfigHook
              pnpm
              pkgs.makeWrapper
            ];

            configurePhase = ''
              runHook preConfigure
              export HOME="$TMPDIR"
              export CI=true
              export NODE_OPTIONS="--max-old-space-size=6144"
              runHook postConfigure
            '';

            buildPhase = ''
              runHook preBuild
              export NUXT_TELEMETRY_DISABLED=1
              pnpm run build
              runHook postBuild
            '';

            installPhase = ''
              runHook preInstall

              # 运行时只需要生产依赖，devDependencies（typescript/eslint/vue-tsc 等）留在构建期
              pnpm prune --prod

              mkdir -p "$out/lib/voicehub" "$out/bin" "$out/lib/voicehub/scripts"

              cp -r .output            "$out/lib/voicehub/"
              cp -r node_modules       "$out/lib/voicehub/"
              cp package.json pnpm-workspace.yaml pnpm-lock.yaml drizzle.config.ts "$out/lib/voicehub/"

              mkdir -p "$out/lib/voicehub/app/drizzle"
              cp -r app/drizzle/.      "$out/lib/voicehub/app/drizzle/"

              # db.ts 运行时依赖该模块（tsx 直跑源码；Node 会把软链解析到 store 真实路径，
              # 因此必须打进包内，仅在 StateDirectory 建软链无效），对齐 Dockerfile 运行阶段
              mkdir -p "$out/lib/voicehub/server/utils"
              cp server/utils/serverless-runtime.ts "$out/lib/voicehub/server/utils/"

              # Nix 运行时只走 deploy.js → db-sync.js/create-admin.js（以及手动构建时的 build.js）；
              # netlify-build/safe-migrate/redis-scan 等平台脚本不在此拷贝
              cp scripts/deploy.js scripts/db-sync.js scripts/create-admin.js \
                scripts/build.js scripts/build-music-source-plugins.ts \
                scripts/postinstall.js scripts/package.json \
                "$out/lib/voicehub/scripts/"

              # wrapper 只启动 .output/server，不经过 deploy.js：
              # PREBUILT/SKIP_* 由 NixOS 模块的 systemd 环境设置，此处仅保留 NODE_ENV
              makeWrapper ${pkgs.nodejs_24}/bin/node "$out/bin/voicehub" \
                --add-flags ".output/server/index.mjs" \
                --chdir "$out/lib/voicehub" \
                --set NODE_ENV production

              runHook postInstall
            '';

            meta = with pkgs.lib; {
              description = "校园广播站点歌管理系统";
              homepage = "https://github.com/laoshuikaixue/VoiceHub";
              license = licenses.gpl3Only;
              mainProgram = "voicehub";
              platforms = pkgs.nodejs_24.meta.platforms;
            };
          });

        in
        {
          packages = {
            inherit voicehub;
            default = voicehub;
          };

          devShells = {
            default = pkgs.mkShell {
              buildInputs = [
                pkgs.nodejs_24
                pnpm
                pkgs.postgresql_15
                pkgs.git
              ];

              shellHook = ''
                echo ""
                echo "  VoiceHub 开发环境"
                echo "  -----------------"
                echo "  Node.js : $(node --version)"
                echo "  pnpm    : $(pnpm --version)"
                echo ""
                echo "  快速开始:"
                echo "    cp .env.example .env   # 配置 DATABASE_URL + JWT_SECRET"
                echo "    pnpm install           # 安装依赖"
                echo "    pnpm run dev           # 启动开发服务器 (port 3000)"
                echo "    pnpm run build         # 构建"
                echo ""
              '';
            };
          };

          apps = {
            default = {
              type = "app";
              program = "${voicehub}/bin/voicehub";
            };

            # Impure build helper — use this to compute the pnpmDeps hash.
            # 默认 node-server/hot 预设无需 DATABASE_URL；若改用 vercel/netlify 等
            # snapshot 预设构建插件快照，需先 export DATABASE_URL 再执行
            build = {
              type = "app";
              program =
                let
                  buildScript = pkgs.writeShellApplication {
                    name = "voicehub-build";
                    runtimeInputs = [
                      pkgs.nodejs_24
                      pnpm
                      pkgs.git
                      pkgs.cacert
                    ];
                    text = ''
                      set -euo pipefail

                      echo "正在构建 VoiceHub v${version} ..."

                      export HOME="''${HOME:-/tmp}"
                      export CI=true
                      export NUXT_TELEMETRY_DISABLED=1
                      export NODE_OPTIONS="--max-old-space-size=6144"
                      export SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt

                      pnpm install --frozen-lockfile
                      pnpm run build

                      echo "构建完成: $(pwd)/.output"
                    '';
                  };
                in
                "${buildScript}/bin/voicehub-build";
            };
          };

          # 真机级验证：VM 内实际执行 deploy.js（迁移 + create-admin）并启动 .output。
          # 求值冒烟看不到 DynamicUser + postgres peer 认证、tsx 运行时解析等运行时故障。
          checks = pkgs.lib.optionalAttrs pkgs.stdenv.hostPlatform.isLinux {
            voicehub-vm = pkgs.testers.runNixOSTest {
              name = "voicehub";

              nodes.machine = { pkgs, ... }: {
                imports = [ self.nixosModules.default ];

                services.voicehub = {
                  enable = true;
                  database.createLocally = true;
                  # deploy.js 强制要求 JWT_SECRET；测试值固定即可
                  extraEnvironment.JWT_SECRET = "voicehub-vm-test-secret-0123456789";
                };

                virtualisation = {
                  memorySize = 3072;
                  cores = 2;
                };

                environment.systemPackages = [ pkgs.curl ];
              };

              testScript = ''
                start_all()
                machine.wait_for_unit("postgresql.service", timeout=120)
                # Type=simple 下 unit 会先变为 active，真正的门是 deploy 结束后才监听的端口
                machine.wait_for_unit("voicehub.service", timeout=900)
                machine.wait_for_open_port(3000, timeout=900)

                machine.succeed("curl -fsS http://127.0.0.1:3000/api/site-config >/dev/null")
                machine.succeed("curl -fsS http://127.0.0.1:3000/api/songs/count >/dev/null")

                machine.succeed("journalctl -u voicehub --no-pager | grep -q '数据库同步成功'")
                machine.succeed("journalctl -u voicehub --no-pager | grep -q '管理员创建成功'")
                machine.succeed("systemctl is-active --quiet voicehub.service")
              '';
            };
          };
        }
      )
    // {

      # ──────────────────────────────────────────────────────────────
      # NixOS Module
      # ──────────────────────────────────────────────────────────────
      nixosModules.default =
        { config
        , lib
        , pkgs
        , ...
        }:
        let
          nodejs = pkgs.nodejs_24;
          pnpm = pkgs.pnpm_10.override {
            version = "10.29.3";
            hash = "sha256-p09NvT9afKh00AQTUnHwtpe2g78f0vwhM5YRYc0lspw=";
          };
          cfg = config.services.voicehub;
        in
        {
          options.services.voicehub = {
            enable = lib.mkEnableOption "启用 VoiceHub 服务";

            package = lib.mkOption {
              type = lib.types.package;
              default = self.packages.${pkgs.stdenv.hostPlatform.system}.default;
              defaultText = lib.literalExpression "self.packages.''${pkgs.stdenv.hostPlatform.system}.default";
              description = "使用的 VoiceHub 包";
            };

            port = lib.mkOption {
              type = lib.types.port;
              default = 3000;
              description = "HTTP 监听端口";
            };

            host = lib.mkOption {
              type = lib.types.str;
              default = "0.0.0.0";
              description = "监听地址";
            };

            database = {

              createLocally = lib.mkOption {
                type = lib.types.bool;
                default = false;
                description = ''
                  是否自动配置本地 PostgreSQL 数据库。
                  启用后将自动启用 services.postgresql、创建数据库和用户，
                  并从 database 选项自动构造 DATABASE_URL。
                '';
              };

              name = lib.mkOption {
                type = lib.types.str;
                default = "voicehub";
              };

              user = lib.mkOption {
                type = lib.types.str;
                default = "voicehub";
              };

              host = lib.mkOption {
                type = lib.types.str;
                default = "/run/postgresql";
                description = "PostgreSQL 主机地址。默认为 Unix 套接字路径，用于本地对等认证。";
              };

            };

            environmentFile = lib.mkOption {
              type = lib.types.nullOr lib.types.path;
              default = null;
              description = "包含敏感变量的环境文件路径（如 JWT_SECRET）";
            };

            extraEnvironment = lib.mkOption {
              type = lib.types.attrsOf lib.types.str;
              default = { };
              description = "额外环境变量";
            };

            runDeployScript = lib.mkOption {
              type = lib.types.bool;
              default = true;
              description = ''
                是否在启动前运行部署脚本（db:migrate + create-admin）。
                当使用独立的迁移流程时可设为 false。
              '';
            };

            openFirewall = lib.mkOption {
              type = lib.types.bool;
              default = false;
              description = "在防火墙中开放 VoiceHub 端口";
            };
          };

          config = lib.mkIf cfg.enable {
            services.postgresql = lib.mkIf cfg.database.createLocally {
              enable = true;
              ensureDatabases = [ cfg.database.name ];
              ensureUsers = [{ name = cfg.database.user; ensureDBOwnership = true; }];
            };

            networking.firewall.allowedTCPPorts = lib.optionals cfg.openFirewall [ cfg.port ];

            systemd.services.voicehub = {
              description = "VoiceHub - 校园广播站点歌服务";
              documentation = [ "https://github.com/laoshuikaixue/VoiceHub" ];

              unitConfig = {
                # 防 Restart=always 在部署失败时无限热循环刷日志（历史原因为防 script 挂死，现为通用熔断）
                StartLimitIntervalSec = 600;
                StartLimitBurst = 3;
              };

              after = [ "network.target" ]
              ++ lib.optionals cfg.database.createLocally [ "postgresql.target" ];
              requires = lib.optionals cfg.database.createLocally [ "postgresql.target" ];
              wantedBy = [ "multi-user.target" ];

              environment =
                {
                  NODE_ENV = "production";
                  PORT = toString cfg.port;
                  HOST = cfg.host;
                  PREBUILT = "true";
                  SKIP_INSTALL = "true";
                  SKIP_BUILD = "true";
                }
                // cfg.extraEnvironment;

              serviceConfig = {
                Type = "simple";
                ExecStart =
                  let
                    startScript = pkgs.writeShellScript "voicehub-start" ''
                      set -e
                      PKG="${cfg.package}/lib/voicehub"
                      STATE="''${STATE_DIRECTORY:-/var/lib/voicehub}"
                      cd "$STATE"
                      export PATH="${pkgs.lib.makeBinPath [ nodejs pnpm pkgs.bash ]}:$PATH"
                      # pnpm run 需从 PATH 解析 sh（缺失时报 exit code -2 即 ENOENT 静默死亡），禁止移除 bash
                      # 运行期可写目录（插件产物 .data、备份 backups、文件日志 logs）必须落在
                      # StateDirectory：/nix/store 只读且 ProtectSystem=strict 下无法写入；
                      # 只读产物以软链引入，升级时 -f 覆盖即可；-T 防止目标误为真实目录时嵌套
                      mkdir -p "$STATE/.data/music-source-plugins" "$STATE/backups" "$STATE/logs/archive"
                      # 自动枚举包内全部顶层条目：仍是零拷贝（仅符号链接），新增文件时无需再维护列表；
                      # 可写目录已在上面创建，跳过包内同名项避免被只读软链覆盖
                      for f in "$PKG"/* "$PKG"/.[!.]*; do
                        [ -e "$f" ] || continue
                        case "$(basename "$f")" in
                          .data|backups|logs) continue ;;
                        esac
                        ln -sfT "$f" "$STATE/$(basename "$f")"
                      done
                      ${lib.optionalString cfg.database.createLocally ''
                        # postgres.js 不消费 DATABASE_URL 中的 ?host= 参数做 Unix 套接字选路，
                        # 空主机 + PGHOST 才会走 /run/postgresql/.s.PGSQL.5432，两者缺一不可
                        export DATABASE_URL="postgresql:///${cfg.database.name}"
                        export PGHOST="${cfg.database.host}"
                      ''}
                      ${lib.optionalString cfg.runDeployScript ''
                        # deploy.js/db-sync.js 自带 DRIZZLE_KIT_FORCE + CI 非交互，无需 script(1) 包裹 pty
                        node scripts/deploy.js || {
                          echo "❌ 部署脚本执行失败"
                          exit 1
                        }
                      ''}
                      exec ${nodejs}/bin/node "$PKG/.output/server/index.mjs"
                    '';
                  in
                  "${startScript}";
                Restart = "always";
                RestartSec = "5s";
                # "-" 前缀：目录不存在时不致命，实际工作目录由启动脚本自行切换
                WorkingDirectory = "-/var/lib/voicehub";

                DynamicUser = true;
                StateDirectory = "voicehub";
                StateDirectoryMode = "0700";

                EnvironmentFile = lib.mkIf (cfg.environmentFile != null) [ cfg.environmentFile ];

                MemoryHigh = "4G";
                MemoryMax = "6G";

                NoNewPrivileges = true;
                PrivateTmp = true;
                ProtectSystem = "strict";
                ProtectHome = true;
                RestrictAddressFamilies = [
                  "AF_INET"
                  "AF_INET6"
                  "AF_UNIX"
                ];
                SystemCallFilter = [
                  "@system-service"
                  "~@privileged"
                ];
              };
            };
          };
        };
    };
}
