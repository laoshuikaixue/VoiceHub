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
              hash = "sha256-wloIw2MktyFq7h2fe2oaJ5wyl7PeBcjuE45mbNt12Yo=";
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

              mkdir -p "$out/lib/voicehub" "$out/bin"

              cp -r .output            "$out/lib/voicehub/"
              cp -r node_modules       "$out/lib/voicehub/"
              cp package.json          "$out/lib/voicehub/"
              cp drizzle.config.ts     "$out/lib/voicehub/"

              mkdir -p "$out/lib/voicehub/app/drizzle"
              cp -r app/drizzle/.      "$out/lib/voicehub/app/drizzle/"

              cp -r scripts            "$out/lib/voicehub/"

              makeWrapper ${pkgs.nodejs_24}/bin/node "$out/bin/voicehub" \
                --add-flags ".output/server/index.mjs" \
                --chdir "$out/lib/voicehub" \
                --set PREBUILT true \
                --set NODE_ENV production \
                --prefix PATH : ${pnpm}/bin

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

            # Impure build helper — use this to compute the pnpmDeps hash
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
                      cd "${cfg.package}/lib/voicehub"
                      export PATH="${pkgs.lib.makeBinPath [ nodejs pnpm pkgs.util-linux pkgs.bash ]}:$PATH"
                      export SHELL="$(command -v bash)"
                      ${lib.optionalString cfg.database.createLocally ''
                        export DATABASE_URL="postgresql:///${cfg.database.name}"
                        export PGHOST="${cfg.database.host}"
                      ''}
                      ${lib.optionalString cfg.runDeployScript ''
                        script -q -c "node scripts/deploy.js" /dev/null || {
                          echo "❌ 部署脚本执行失败"
                          exit 1
                        }
                      ''}
                      exec ${cfg.package}/bin/voicehub
                    '';
                  in
                  "${startScript}";
                Restart = "always";
                RestartSec = "5s";
                WorkingDirectory = "${cfg.package}/lib/voicehub";

                DynamicUser = true;

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
