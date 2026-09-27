import fs from 'fs';
import {
  buildSrsDocument,
  buildSynopsisDocument,
  buildVivaQuestionsDocument
} from './src/docsExport.js';

const roadmap = JSON.parse(fs.readFileSync('sample_generated_roadmap.json', 'utf-8'));
const vivaData = JSON.parse(fs.readFileSync('sample_generated_viva.json', 'utf-8'));

const idea = roadmap.original_idea || 'A smart meal planner and grocery budgeting app that creates weekly meal plans based on dietary preferences, tracks grocery expenses, and generates optimized shopping lists.';

const srsMd = buildSrsDocument(roadmap, idea);
const synopsisMd = buildSynopsisDocument(roadmap, idea);
const vivaMd = buildVivaQuestionsDocument(roadmap, vivaData, idea);

fs.writeFileSync('Meal_Planner_SRS_Document.md', srsMd, 'utf-8');
fs.writeFileSync('Meal_Planner_Synopsis.md', synopsisMd, 'utf-8');
fs.writeFileSync('Meal_Planner_Viva_Questions.md', vivaMd, 'utf-8');

console.log('Saved Meal_Planner_SRS_Document.md (chars: ' + srsMd.length + ')');
console.log('Saved Meal_Planner_Synopsis.md (chars: ' + synopsisMd.length + ')');
console.log('Saved Meal_Planner_Viva_Questions.md (chars: ' + vivaMd.length + ')');
