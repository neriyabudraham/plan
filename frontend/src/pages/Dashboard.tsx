import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BanknotesIcon,
  UserGroupIcon,
  FlagIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import {
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import toast from 'react-hot-toast';
import api, { handleApiError } from '../services/api';
import { FamilySummary, AssetsSummary, GoalsSummary, ASSET_TYPE_LABELS, ASSET_TYPE_ICONS } from '../types';
import Loading from '../components/common/Loading';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [family, setFamily] = useState<FamilySummary | null>(null);
  const [assets, setAssets] = useState<AssetsSummary | null>(null);
  const [goals, setGoals] = useState<GoalsSummary | null>(null);
  
  useEffect(() => {
    fetchData();
  }, []);
  
  const fetchData = async () => {
    try {
      const [familyRes, assetsRes, goalsRes] = await Promise.all([
        api.get<FamilySummary>('/family/summary'),
        api.get<AssetsSummary>('/assets/summary/all'),
        api.get<GoalsSummary>('/goals/summary/all'),
      ]);
      setFamily(familyRes.data);
      setAssets(assetsRes.data);
      setGoals(goalsRes.data);
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) return <Loading />;
  
  const pieData = assets?.by_type.map((item, i) => ({
    name: ASSET_TYPE_LABELS[item.asset_type],
    value: Number(item.total_balance),
    color: COLORS[i % COLORS.length],
    icon: ASSET_TYPE_ICONS[item.asset_type],
  })) || [];
  
  const hasData = (assets?.totals?.total || 0) > 0 || (goals?.total_goals || 0) > 0;
  
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            שלום, {family?.self?.name || 'אורח'} 👋
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            סקירה כללית של המצב הפיננסי
          </p>
        </div>
        <Link to="/simulator" className="btn-primary flex items-center gap-2">
          <ChartBarIcon className="w-5 h-5" />
          סימולטור
        </Link>
      </div>
      
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="סה״כ נכסים"
          value={`₪${(assets?.totals?.total || 0).toLocaleString()}`}
          icon={BanknotesIcon}
          gradient="from-blue-500 to-cyan-500"
          bgGradient="from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20"
        />
        <StatCard
          title="הפקדות חודשיות"
          value={`+₪${(assets?.totals?.monthly_deposits || 0).toLocaleString()}`}
          icon={ArrowTrendingUpIcon}
          gradient="from-emerald-500 to-green-500"
          bgGradient="from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20"
          valueClass="text-emerald-600"
        />
        <StatCard
          title="יעדים פעילים"
          value={`${(goals?.total_goals || 0) - (goals?.achieved_count || 0)}`}
          subtext={`${goals?.achieved_count || 0} הושגו`}
          icon={FlagIcon}
          gradient="from-purple-500 to-violet-500"
          bgGradient="from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20"
        />
        <StatCard
          title="בני משפחה"
          value={`${family?.totalMembers || 0}`}
          subtext={`${family?.childrenCount || 0} ילדים, ${family?.plannedChildrenCount || 0} מתוכננים`}
          icon={UserGroupIcon}
          gradient="from-pink-500 to-rose-500"
          bgGradient="from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20"
        />
      </div>
      
      {hasData ? (
        <>
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Goals Progress */}
            <div className="lg:col-span-2 card p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">התקדמות ביעדים</h2>
                <Link to="/goals" className="text-primary-600 text-sm font-medium hover:underline">
                  כל היעדים ←
                </Link>
              </div>
              
              {goals && goals.goals.length > 0 ? (
                <div className="space-y-4">
                  {goals.goals.slice(0, 5).map((goal) => (
                    <div key={goal.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{goal.icon}</span>
                          <span className="font-medium text-gray-900 dark:text-white">{goal.name}</span>
                        </div>
                        <span className="text-sm font-bold" style={{ color: goal.color }}>
                          {goal.progress_percent || 0}%
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${Math.min(goal.progress_percent || 0, 100)}%`, backgroundColor: goal.color }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>₪{Number(goal.current_amount).toLocaleString()}</span>
                        <span>₪{Number(goal.target_amount).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FlagIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500 mb-4">אין יעדים עדיין</p>
                  <Link to="/goals" className="btn-primary">
                    <PlusIcon className="w-5 h-5 ml-1" />
                    הוסף יעד
                  </Link>
                </div>
              )}
            </div>
            
            {/* Assets Distribution */}
            <div className="card p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">חלוקת נכסים</h2>
              
              {pieData.length > 0 ? (
                <>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={4}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} strokeWidth={0} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => `₪${value.toLocaleString()}`}
                          contentStyle={{ backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', direction: 'rtl' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="space-y-2 mt-4">
                    {pieData.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-gray-600 dark:text-gray-400">{item.icon} {item.name}</span>
                        </div>
                        <span className="font-medium">₪{item.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <BanknotesIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500 mb-4">אין נכסים</p>
                  <Link to="/assets" className="btn-primary">
                    <PlusIcon className="w-5 h-5 ml-1" />
                    הוסף נכס
                  </Link>
                </div>
              )}
            </div>
          </div>
          
          {/* Family Overview */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">המשפחה</h2>
              <Link to="/family" className="text-primary-600 text-sm font-medium hover:underline">
                ערוך ←
              </Link>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {family?.self && (
                <FamilyCard member={family.self} type="self" />
              )}
              {family?.spouse && (
                <FamilyCard member={family.spouse} type="spouse" />
              )}
              {family?.children?.map(child => (
                <FamilyCard key={child.id} member={child} type="child" />
              ))}
              {family?.plannedChildren?.map(child => (
                <FamilyCard key={child.id} member={child} type="planned" />
              ))}
              
              {!family?.self && !family?.spouse && (
                <Link
                  to="/family"
                  className="p-4 border-2 border-dashed border-gray-200 rounded-xl hover:border-primary-400 transition-colors flex items-center justify-center"
                >
                  <div className="text-center">
                    <PlusIcon className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                    <span className="text-sm text-gray-500">הוסף פרופיל</span>
                  </div>
                </Link>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Empty State */
        <div className="card p-12 text-center">
          <div className="text-6xl mb-4">🚀</div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">בואו נתחיל!</h3>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            כדי להתחיל לתכנן את העתיד הפיננסי שלך, צריך להגדיר כמה דברים בסיסיים
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
            <Link to="/family" className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl hover:bg-blue-100 transition-colors">
              <UserGroupIcon className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <h4 className="font-semibold text-gray-900 dark:text-white">1. הגדר משפחה</h4>
              <p className="text-sm text-gray-500">פרטים אישיים ובני משפחה</p>
            </Link>
            
            <Link to="/assets" className="p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl hover:bg-emerald-100 transition-colors">
              <BanknotesIcon className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <h4 className="font-semibold text-gray-900 dark:text-white">2. הוסף נכסים</h4>
              <p className="text-sm text-gray-500">חסכונות והשקעות</p>
            </Link>
            
            <Link to="/goals" className="p-6 bg-purple-50 dark:bg-purple-900/20 rounded-xl hover:bg-purple-100 transition-colors">
              <FlagIcon className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <h4 className="font-semibold text-gray-900 dark:text-white">3. הגדר יעדים</h4>
              <p className="text-sm text-gray-500">מה רוצים להשיג?</p>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  subtext,
  icon: Icon,
  gradient,
  bgGradient,
  valueClass,
}: {
  title: string;
  value: string;
  subtext?: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  bgGradient: string;
  valueClass?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${bgGradient} p-6 border border-white/50 dark:border-gray-700/50 shadow-lg`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className={`text-2xl font-bold mt-2 ${valueClass || 'text-gray-900 dark:text-white'}`}>
            {value}
          </p>
          {subtext && (
            <p className="text-sm text-gray-500 mt-1">{subtext}</p>
          )}
        </div>
        <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      <div className={`absolute -bottom-4 -left-4 w-24 h-24 bg-gradient-to-br ${gradient} rounded-full opacity-10 blur-2xl`} />
    </div>
  );
}

function FamilyCard({ member, type }: { member: any; type: 'self' | 'spouse' | 'child' | 'planned' }) {
  const icons = {
    self: '👤',
    spouse: '💑',
    child: '👶',
    planned: '✨',
  };
  
  return (
    <div className={`p-4 rounded-xl ${type === 'planned' ? 'bg-purple-50 dark:bg-purple-900/20' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
      <div className="text-2xl mb-2">{icons[type]}</div>
      <h4 className="font-semibold text-gray-900 dark:text-white">{member.name}</h4>
      {member.age_years !== undefined && member.age_years !== null && (
        <p className="text-sm text-gray-500">גיל: {member.age_years}</p>
      )}
      {type === 'planned' && member.expected_birth_date && (
        <p className="text-sm text-purple-600">
          צפוי: {new Date(member.expected_birth_date).toLocaleDateString('he-IL')}
        </p>
      )}
    </div>
  );
}
