const child_process = require('child_process');
const fs = require('fs');
const xml2js = require('xml2js');
const rimraf = require('rimraf');
const path = require('path');
const argv = require('yargs').argv

const run = async () => {
  // Extract dlls
  let dlls = [];
  const parser = new xml2js.Parser();
  const assemblyFile = fs.readFileSync(path.join(process.cwd(), 'Examples', 'Assembly-CSharp.csproj'));
  const assemblyXml = await parser.parseStringPromise(assemblyFile);
  assemblyXml.Project.ItemGroup.forEach((itemGroup) => {
    if (itemGroup.Reference) {
      itemGroup.Reference.forEach((ref) => {
        dlls = dlls.concat(ref.HintPath);
      })
    }
  });

  // Compile code
  const apiXmlName = `api.xml`;
  const assemblyName = `Packages.dll`;
  const cmd = `csc -recurse:${path.join(process.cwd(), 'Packages', '/*.cs')} /doc:${path.join(process.cwd(), apiXmlName)} -t:library -out:${path.join(process.cwd(), assemblyName)} -r:${dlls.join(',')} -define:UNITY_2019_1_OR_NEWER`;
  try {
    const compileStdout = child_process.execSync(cmd);
  } catch(e) {
    console.error(e.status);
    console.error(e.message);
    console.error(e.stderr.toString());
    console.error(e.stdout.toString());
    process.exit(1);
  }

  if (argv.verbose) {
    console.log("Stdout from source code compilation:");
    console.log(compileStdout.toString());
  }

  // Remove generated assembly
  rimraf.sync(path.join(process.cwd(), assemblyName));

  // Parse docs xml
  const docsXmlFile = fs.readFileSync(path.join(process.cwd(), apiXmlName));
  const docsXml = await parser.parseStringPromise(docsXmlFile);

  const NAMESPACES = [
    'UnityAtoms.',
    'UnityAtoms.Editor.',
    'UnityAtoms.Tags.',
    'UnityAtoms.Tags.Editor.',
    'UnityAtoms.Mobile.',
    'UnityAtoms.Mobile.Editor.',
    'UnityAtoms.UI.',
    'UnityAtoms.UI.Editor.',
    'UnityAtoms.SceneMgmt.',
    'UnityAtoms.SceneMgmt.Editor.',
    'UnityAtoms.MonoHooks.',
    'UnityAtoms.MonoHooks.Editor.'
  ];

  const getNamespace = (name) => {
    const matches = NAMESPACES.filter((ns) => name.includes(ns));
    const namespace = matches.sort((a, b) => (b.match(/./g) || []).length - (a.match(/./g) || []).length)[0];
    return namespace.substring(0, namespace.length - 1);
  }

  const extractFromName = (name) => {
    const [type, ...restOfName] = name.split(':');
    const namespace = getNamespace(name);
    const toReturn = { type, namespace };

    if (type === 'T') {
      toReturn.className = restOfName[0].substring(namespace.length + 1);
    } else if (type === 'M' || type === 'P' || type === 'F') {
      const rest = restOfName[0].substring(namespace.length + 1);
      const indexOfFirstParenthesis = rest.indexOf('(');
      let className, restName;
      if (indexOfFirstParenthesis !== -1) {
        const indexOfMethodNameStart = rest.substring(0, indexOfFirstParenthesis).lastIndexOf('.') + 1;
        className = rest.substring(0, indexOfMethodNameStart - 1);
        restName = rest.substring(indexOfMethodNameStart, rest.length);
      } else {
        const splitName = restOfName[0].substring(namespace.length + 1).split('.');
        restName = splitName.pop();
        className = splitName.join('.');
      }
      toReturn.className = className;
      toReturn.name = restName;
    }
    return toReturn;
  }

  // EXAMPLE FORMAT:
  // const prettifiedAndGroupedJsonExample = [
  //   {
  //     namespace: 'UnityAtoms',
  //     classes: [{
  //       id: 'AtomListener',
  //       name: 'AtomListener'
  //       summary: '12312312',
  //       methods: [{}]
  //       properties: [{}]
  //       variables: [{}]]
  //     }],
  //   }
  // ];

  const prettifiedAndGroupedJson = [];
  // Prettify
  const prettifiedXml = docsXml.doc.members[0].member.map((cur) => {
    const summary = cur.summary && cur.summary[0];
    const params = cur.param && cur.param.length > 0 && cur.param.map((p) => ({ name: p['$'].name, description: p['_'] }));
    const returns = cur.returns && cur.returns.length > 0 && cur.returns[0];
    const value = cur.value && cur.value.length > 0 && cur.value[0];
    const examples = cur.example && cur.example.length > 0 && cur.example.map((ex) => ex.code[0]);
    const typeparams = cur.typeparam && cur.typeparam.length > 0 && cur.typeparam.map((tp) => ({ name: tp['$'].name, description: tp['_'] }));
    const extractedFromName = extractFromName(cur['$'].name);

    // Add namespace and classes
    let namespaceGroup = prettifiedAndGroupedJson.find((n) => n.namespace === extractedFromName.namespace);
    if (!namespaceGroup) {
      namespaceGroup = { namespace: extractedFromName.namespace, classes: [] };
      prettifiedAndGroupedJson.push(namespaceGroup);
    }
    if (extractedFromName.type === 'T') {
      namespaceGroup.classes.push({
        id: extractedFromName.className,
        name: extractedFromName.className.includes('`') && typeparams ? extractedFromName.className.replace(/`\d/, `<${typeparams.map((tp) => tp.name).join(',')}>`) : extractedFromName.className,
        typeparams,
        summary,
        methods: [],
        properties: [],
        variables: [],
      });
    }

    return { summary, params, returns, value, examples, typeparams, ...extractedFromName };
  }, []);

  // Add all methods, properties and variables
  prettifiedXml.filter((cur) => ['M', 'F', 'P'].includes(cur.type)).forEach((cur) => {
    const classGroup = prettifiedAndGroupedJson.find((n) => n.namespace === cur.namespace).classes.find((n) => n.id === cur.className);
    if (classGroup) {
      if (cur.type === 'M') {
        if (cur.name.includes('Do(')) {

        }

        let name = cur.name;
        if (name.includes('``') && cur.typeparams) {
          name = name.replace(/``\d/, `<${cur.typeparams.map((tp) => tp.name).join(',')}>`);
        }
        if (name.includes('`') && cur.params) {
          name = name.replace(/\(([^\)]+)\)/, `(${cur.params.map((p) => p.name).join(',')})`);
        }
        classGroup.methods.push({
          ...cur,
          name,
        });
      } else if (cur.type === 'F') {
        classGroup.variables.push(cur);
      } else if (cur.type === 'P') {
        classGroup.properties.push(cur);
      }
    }
  });

  const printExamples = (examples) => {
    if (!examples) return '';

    return `##### Examples\n\n${examples.map((example) => {
      const exampleSplitOnNewline = example.split('\n');
      const numSpacesFirstRow = exampleSplitOnNewline[1].search(/\S/);
      const trimmedExample = exampleSplitOnNewline.map((line) => line.substring(numSpacesFirstRow)).join('\n');
      return `\`\`\`cs${trimmedExample}\`\`\``;
    }).join('\n\n')}\n\n`;
  }

  const printValues = (values = '') => {
    const trimmedValues = values.replace(/\s+/g, ' ').trim();
    if (!trimmedValues) return '';
    return `##### Values\n\n${trimmedValues}\n\n`;
  }

  const printReturns = (returns = '') => {
    const trimmedReturns = returns.replace(/\s+/g, ' ').trim();
    if (!trimmedReturns) return '';
    return `##### Returns\n\n${trimmedReturns}\n\n`;
  }

  const printSummary = (summary = '') => {
    const trimmedSummary = summary.replace(/\s+/g, ' ').trim();
    if (!trimmedSummary) return '';
    return(`${trimmedSummary}\n\n`);
  }

  const printTypeParams = (typeparams) => {
    if (!typeparams || typeparams.length <= 0) return '';
    return(`#### Type Parameters\n\n${typeparams.map((tp) => `-   \`${tp.name}\` - ${tp.description}`).join('\n')}\n\n`);
  }

  const printParameters = (params) => {
    if (!params || params.length <= 0) return '';
    return (`##### Parameters\n\n${params.map((param) => `-   \`${param.name}\` - ${param.description}`).join('\n')}\n\n`);
  }

  const printVariablesSection = (variables) => {
    if (!variables || variables.length <= 0) return '';
    return `### Variables\n\n${variables.map((v) => {
      return `#### \`${v.name}\`\n\n${printSummary(v.summary)}`;
    }).join('---\n\n')}`;
  }

  const printPropertiesSection = (properties) => {
    if (!properties || properties.length <= 0) return '';
    return `### Properties\n\n${properties.map((prop) => {
      return `#### \`${prop.name}\`\n\n${printSummary(prop.summary)}${printValues(prop.values)}${printExamples(prop.examples)}`
    }).join('---\n\n')}`;
  }

  const printMethodsSection = (methods) => {
    if (!methods || methods.length <= 0) return '';
    return `### Methods\n\n${methods.map((method) => {
      return `#### \`${method.name}\`\n\n${printSummary(method.summary)}${printTypeParams(method.typeparams)}${printParameters(method.params)}${printReturns(method.returns)}${printExamples(method.examples)}`
    }).join('---\n\n')}`;
  }

  const printClasses = (classes) => {
    if (!classes || classes.length <= 0) return '';
    return classes.map((c) => {
      return `## \`${c.name}\`\n\n${printTypeParams(c.typeparams)}${printSummary(c.summary)}${printVariablesSection(c.variables)}${printPropertiesSection(c.properties)}${printMethodsSection(c.methods)}---\n\n`
    }).join('');
  }

  const printNamespace = (namespace) => `# Namespace - \`${namespace.namespace}\`\n\n${printClasses(namespace.classes)}`;

  const printPageMeta = (namespace) => `---\nid: ${namespace.toLowerCase()}\ntitle: ${namespace}\nhide_title: true\nsidebar_label: ${namespace}\n---\n\n`;

  // Create one MD file per namespace
  prettifiedAndGroupedJson.forEach((namespace) => {
    const mdPath = path.join(process.cwd(), 'docs', 'api', `${namespace.namespace.toLowerCase()}.md`);
    const mdFile = `${printPageMeta(namespace.namespace)}${printNamespace(namespace)}`;
    fs.writeFileSync(mdPath, mdFile.substring(0, mdFile.length - 1)); // Trim last new line
  });

  // Remove generated xml
  rimraf.sync(path.join(process.cwd(), apiXmlName));
}

run();

