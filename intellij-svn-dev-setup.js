const fs = require("fs");
const path = require("path");
const {spawn} = require("child_process");
const inquirer = require("inquirer");
const chalk = require("chalk");
const cliProgress = require("cli-progress");

// pkg 빌드 환경 대응 경로 설정
const isPkg = typeof process.pkg !== 'undefined';
const ROOT_PATH = isPkg ? path.dirname(process.execPath) : __dirname;

const cfgPath = path.join(ROOT_PATH, "config/config.json");
const templateDir = path.join(ROOT_PATH, "template");

if (!fs.existsSync(cfgPath)) {
    console.log(chalk.red("❌ config/config.json 없음"));
    // 빌드 후 바로 꺼지는 것 방지
    setTimeout(() => process.exit(1), 3000);
}
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));

/**
 * Util 함수들
 */
function log(line) {
    process.stdout.write(chalk.gray(line + "\n"));
}

function getAllFiles(dir, arr = []) {
    if (!fs.existsSync(dir)) return arr;

    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const full = path.join(dir, file);
        try {
            if (fs.lstatSync(full).isDirectory()) {
                getAllFiles(full, arr);
            } else {
                arr.push(full);
            }
        } catch (e) {
        }
    });
    return arr;
}

function createBar(label) {
    return new cliProgress.SingleBar({
        format: `${chalk.cyan(label)} |{bar}| {percentage}%`,
        barCompleteChar: "█",
        barIncompleteChar: "░",
        hideCursor: true,
    });
}

function initUI() {
    console.clear();
    console.log(chalk.bold.blue("🚀 IntelliJ SVN DEV INSTALLER\n"));

    console.log("📌 사전 준비 사항");
    console.log(chalk.gray("✔  SVN CLI 설치"));
    console.log(chalk.gray("✔  Tomcat 8.5 이상 설치"));
    console.log(chalk.gray("✔  Node.js 18+ 설치"));
    console.log(chalk.gray("✔  IntelliJ Ultimate(권장)\n"));

    console.log("📦 진행 순서");
    console.log(chalk.gray("1. SVN Checkout"));
    console.log(chalk.gray("2. 설정 Template Copy"));
    console.log(chalk.gray("3. 환경 설정"));
    console.log(chalk.gray("4. IntelliJ 실행 최적화 RunConfig Fix"));
    console.log("-".repeat(60));
}


function fixRunConfig(targetDir, port) {
    const runDir = path.join(targetDir, ".idea", "runConfigurations");
    if (!fs.existsSync(runDir)) {
        console.log("⚠️ runConfigurations 폴더 없음 (template 확인 필요)");
        return;
    }

    const files = fs.readdirSync(runDir).filter(f => f.endsWith(".xml"));
    files.forEach(file => {
        const full = path.join(runDir, file);
        let xml = fs.readFileSync(full, "utf8");

        // 1. 일반 <port value="..." /> 형태 치환
        xml = xml.replace(/<port value=".*?"/g, `<port value="${port}"`);

        // 기존에 <server-settings> 태그가 있으면 내부를 갈아끼우고, 없으면 통째로 삽입
        const serverSettingsBody = `
                <server-settings>
                  <option name="BASE_DIRECTORY_NAME" value="AUTO_GENERATED_ID" />
                  <option name="HTTP_PORT" value="${port}" />
                  <option name="JMX_PORT" value="${parseInt(port) + 100}" />
                </server-settings>
        `;

        if (xml.includes("<server-settings>")) {
            // 기존 <server-settings>...</server-settings> 구간을 통째로 치환
            xml = xml.replace(/<server-settings>([\s\S]*?)<\/server-settings>/, serverSettingsBody);
        } else {
            // 없으면 </configuration> 직전에 삽입
            xml = xml.replace("</configuration>", `${serverSettingsBody}\n  </configuration>`);
        }

        fs.writeFileSync(full, xml, "utf8");
    });
    console.log(`✔ RunConfig 수정 완료 (Port: ${port})`);
}

function waitExit() {
    console.log(chalk.gray("\n" + "-".repeat(60)));
    return inquirer.prompt([
        {
            type: "input",
            name: "exit",
            message: chalk.cyan("======> 종료하려면 아무 키나 누르세요(Press any key to exit)")
        }
    ]);
}

/**
 * main
 */
(async function main() {
    initUI();

    const answers = await inquirer.prompt([
        {name: "projectName", message: "📦 프로젝트명 (SVN):", default: `${cfg.defaultProjectName}`},
        {name: "projectHome", message: "🛠️️ 설치할 프로젝트 경로:", default: `${cfg.defaultProjectDir}`},
        {name: "tomcatHome", message: "🛠️ Tomcat 경로:", default: `${cfg.defaultTomcatHome}`},
        {name: "port", message: "⚡ 서비스 포트:", default: `${cfg.defaultPort}`}
    ]);

    if(!fs.existsSync(answers.tomcatHome)) {
        console.log(chalk.red("❌ Tomcat 경로가 올바르지 않습니다."));
        await waitExit();
        process.exit(1);
    }

    const targetDir = path.join(answers.projectHome, answers.projectName);
    const svnUrl = `${cfg.svnRootUrl}${answers.projectName}`;
    const vars = {
        PROJECT_NAME: answers.projectName,
        TOMCAT_HOME: answers.tomcatHome,
        SERVER_PORT: String(answers.port),
    };

    try {
        // STEP 1 SVN
        console.log(chalk.yellow("\n📡 SVN Checkout 중...\n"));
        console.log(chalk.gray("  파일 목록 스캔 중..."));

        const totalItems = await new Promise((resolve, reject) => {
            const list = spawn("svn", ["list", "-R", svnUrl]);
            let count = 0, remainder = "", errorList = "";

            list.stdout.on("data", d => {
                const lines = (remainder + d.toString()).split("\n");
                remainder = lines.pop();
                count += lines.filter(l => l.trim().length > 0).length;
            });
            list.stderr.on("data", d => {
                errorList += d.toString();
            });
            list.on("close", code => {
                if (code !== 0) return reject(new Error(`[SVN list 실패]\n${errorList.trim() || "URL 확인 필요"}`));
                if (remainder.length > 0) count++;
                resolve(count);
            });
        });

        console.log(chalk.gray(`  총 ${totalItems}개 항목 확인\n`));

        const multiBar = new cliProgress.MultiBar({
            format: `${chalk.cyan("SVN")} |{bar}| {percentage}% · {value}/{total}  ${chalk.gray("[L] 로그 토글")}`,
            barCompleteChar: "█", barIncompleteChar: "░", hideCursor: true
        });
        const svnBar = multiBar.create(totalItems, 0);

        await new Promise((resolve, reject) => {
            let showLog = true;

            if (process.stdin.isTTY) {
                process.stdin.setRawMode(true);
                process.stdin.resume();
                process.stdin.on("data", key => {
                    if (key.toString().toLowerCase() === "l") {
                        showLog = !showLog;
                        multiBar.log(chalk.yellow(`[LOG ${showLog ? "ON" : "OFF"}]\n`));
                    }
                });
            }

            const svn = spawn("svn", ["checkout", svnUrl, targetDir]);
            let processed = 0, remainder = "";
            svn.stdout.on("data", d => {
                const lines = (remainder + d.toString()).split("\n");
                remainder = lines.pop();
                lines.forEach(line => {
                    if (/^[A-Z]\s/.test(line.trim())) {
                        processed++;
                        svnBar.update(Math.min(processed, totalItems));
                    }
                    if (showLog) {
                        multiBar.log(chalk.gray(line.trim()) + "\n");
                    }
                });
            });
            svn.on("close", code => {
                svnBar.update(totalItems);
                multiBar.stop();
                if (process.stdin.isTTY) {
                    process.stdin.setRawMode(false);
                    process.stdin.pause();
                }
                code === 0 ? resolve() : reject(new Error("SVN 실패"));
            });
        });

        // STEP 2 TEMPLATE COPY
        console.log(chalk.yellow("\n📁 Template 복사 중...\n"));
        const tplFiles = getAllFiles(templateDir);
        const bar1 = createBar("Copy");
        bar1.start(tplFiles.length, 0);

        tplFiles.forEach((file, i) => {
            const rel = path.relative(templateDir, file);
            const dest = path.join(targetDir, rel);
            fs.mkdirSync(path.dirname(dest), {recursive: true});
            fs.copyFileSync(file, dest);
            bar1.update(i + 1);
        });
        bar1.stop();

        // 파일명 치환
        const copiedFiles = getAllFiles(targetDir);

        copiedFiles.forEach((file) => {
            const dir = path.dirname(file);
            const base = path.basename(file);

            if(base.includes("${PROJECT_NAME}")) {
                const newName = base.replaceAll("${PROJECT_NAME}", vars.PROJECT_NAME);
                const newPath = path.join(dir, newName);

                fs.renameSync(file, newPath);
            }
        })

        // STEP 3 VARIABLE INJECT
        console.log(chalk.yellow("\n⚙️ 환경 설정 중...\n"));

        const files = getAllFiles(targetDir);
        const bar2 = createBar("Inject");
        bar2.start(files.length, 0);
        const TEXT_EXT = [".xml", ".properties", ".json", ".jsp", ".js"];

        files.forEach((file, i) => {
            if (TEXT_EXT.includes(path.extname(file))) {
                let content = fs.readFileSync(file, "utf8");
                Object.entries(vars).forEach(([k, v]) => {
                    content = content.replaceAll(`\${${k}}`, v);
                });
                fs.writeFileSync(file, content, "utf8");
            }
            bar2.update(i + 1);
        });
        bar2.stop();

        // STEP 4 IntelliJ FIX
        console.log(chalk.yellow("\n🧠 IntelliJ RunConfig Fix...\n"));
        fixRunConfig(targetDir, String(answers.port));

        console.log("\n" + "=".repeat(60));
        console.log(chalk.green.bold("🎉 INSTALL COMPLETE"));
        console.log(`📁 ${targetDir}`);
        console.log("👉 IntelliJ에서 열고 바로 실행 가능");
        console.log("=".repeat(60) + "\n");

    } catch (e) {
        console.log("\n" + chalk.bgRed.white(" ⚠️ ERROR ") + " " + chalk.red(e.message));
    } finally {
        await waitExit();
    }
})();