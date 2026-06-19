{
  description = "VoiceHub - 校园广播站点歌管理系统";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    { self
    , nixpkgs
    , flake-utils
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };

        nodejs = pkgs.nodejs_22;
        version = "1.5.8.2";

        # Pin pnpm to exact version matching package.json (packageManager field)
        pnpm = pkgs.pnpm_10.override {
          version = "10.29.3";
          hash = "sha256-p09NvT9afKh00AQTUnHwtpe2g78f0vwhM5YRYc0lspw=";
        };

        voicehub = pkgs.stdenv.mkDerivation (finalAttrs: {
          pname = "voicehub";
          inherit version;

          src = self;

          pnpmDeps = pkgs.fetchPnpmDeps {
            inherit (finalAttrs) pname version src;
            inherit pnpm;
            fetcherVersion = 4;
            hash = "sha256-MGdGLwunE3U35l219/A+MzzY50I0JwM4YDRsoZsnoAA=";
          };

          nativeBuildInputs = [
            nodejs
            pkgs.pnpmConfigHook
            pnpm
            pkgs.makeWrapper
          ];

          configurePhase = ''
            runHook preConfigure
            export HOME="$TMPDIR"
            export NODE_OPTIONS="--max-old-space-size=8192"
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

            # Runtime files (.output, node_modules, package.json, configs)
            cp -r .output            "$out/lib/voicehub/"
            cp -r node_modules       "$out/lib/voicehub/"
            cp package.json          "$out/lib/voicehub/"
            cp drizzle.config.ts     "$out/lib/voicehub/"

            # Drizzle migrations
            mkdir -p "$out/lib/voicehub/app/drizzle"
            cp -r app/drizzle/.      "$out/lib/voicehub/app/drizzle/"

            # Helper scripts (deploy, db-sync, create-admin)
            cp -r scripts            "$out/lib/voicehub/"

            # Wrapper binary
            makeWrapper ${nodejs}/bin/node "$out/bin/voicehub" \
              --add-flags ".output/server/index.mjs" \
              --chdir "$out/lib/voicehub" \
              --set PREBUILT true \
              --set NODE_ENV production \
              --prefix PATH : ${pnpm}/bin

            runHook postInstall
          '';

          meta = with pkgs.lib; {
            description = "Campus Radio Station Song Request Management System";
            homepage = "https://github.com/laoshuikaixue/VoiceHub";
            license = licenses.mit;
            mainProgram = "voicehub";
            platforms = nodejs.meta.platforms;
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
              nodejs
              pnpm
              pkgs.postgresql
              pkgs.git
            ];

            shellHook = ''
              echo ""
              echo "  VoiceHub Development Shell"
              echo "  ---------------------------"
              echo "  Node.js : $(node --version)"
              echo "  pnpm    : $(pnpm --version)"
              echo ""
              echo "  Quick start:"
              echo "    cp .env.example .env   # configure DATABASE_URL + JWT_SECRET"
              echo "    pnpm install           # install dependencies"
              echo "    pnpm run dev           # start dev server (port 3000)"
              echo "    pnpm run build         # production build"
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
                    nodejs
                    pnpm
                    pkgs.git
                    pkgs.cacert
                  ];
                  text = ''
                    set -euo pipefail

                    echo "Building VoiceHub v${version} ..."

                    export HOME="''${HOME:-/tmp}"
                    export NODE_OPTIONS="--max-old-space-size=6144"
                    export SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt

                    pnpm install --frozen-lockfile
                    pnpm run build

                    echo "Build complete: $(pwd)/.output"
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
          cfg = config.services.voicehub;
        in
        {
          options.services.voicehub = {
            enable = lib.mkEnableOption "VoiceHub service";

            package = lib.mkOption {
              type = lib.types.package;
              default = self.packages.${pkgs.system}.default;
              defaultText = lib.literalExpression "self.packages.''${pkgs.system}.default";
              description = "VoiceHub package to use";
            };

            port = lib.mkOption {
              type = lib.types.port;
              default = 3000;
              description = "HTTP listen port";
            };

            host = lib.mkOption {
              type = lib.types.str;
              default = "0.0.0.0";
              description = "Host address to bind to";
            };

            databaseUrl = lib.mkOption {
              type = lib.types.str;
              description = "PostgreSQL connection URL (DATABASE_URL)";
              example = "postgresql://voicehub:secret@localhost:5432/voicehub";
            };

            environmentFile = lib.mkOption {
              type = lib.types.nullOr lib.types.path;
              default = null;
              description = "Path to environment file containing sensitive variables like JWT_SECRET";
            };

            extraEnvironment = lib.mkOption {
              type = lib.types.attrsOf lib.types.str;
              default = { };
              description = "Extra environment variables";
            };

            runDeployScript = lib.mkOption {
              type = lib.types.bool;
              default = true;
              description = ''
                Run the deploy script (db:migrate + create-admin) before starting.
                Set to false when a separate replication or migration process is used.
              '';
            };
          };

          config = lib.mkIf cfg.enable {
            systemd.services.voicehub = {
              description = "VoiceHub - Campus Radio Song Request Service";
              documentation = [ "https://github.com/laoshuikaixue/VoiceHub" ];
              after = [ "network.target" ];
              wantedBy = [ "multi-user.target" ];

              environment =
                {
                  NODE_ENV = "production";
                  PORT = toString cfg.port;
                  HOST = cfg.host;
                  DATABASE_URL = cfg.databaseUrl;
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
                      export PATH="${pkgs.lib.makeBinPath [ pkgs.nodejs_22 pkgs.pnpm ]}:$PATH"
                      ${lib.optionalString cfg.runDeployScript ''
                        echo "[voicehub] Running deploy script..."
                        node scripts/deploy.js
                        echo "[voicehub] Deploy complete."
                      ''}
                      exec ${cfg.package}/bin/voicehub
                    '';
                  in
                  "${startScript}";
                Restart = "always";
                RestartSec = "5s";
                WorkingDirectory = "${cfg.package}/lib/voicehub";

                User = "voicehub";
                Group = "voicehub";
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
