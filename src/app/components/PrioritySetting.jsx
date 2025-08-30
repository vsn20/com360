'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Save, RotateCcw, X, ArrowUp, ArrowDown, Edit2 } from 'lucide-react';
import styles from './prioritysettings.module.css';

const PrioritySettingComponent = ({ initialMenus = [], orgid, onSave }) => {
  const [menuItems, setMenuItems] = useState([]);
  const [originalMenuItems, setOriginalMenuItems] = useState([]);
  const [expandedMenus, setExpandedMenus] = useState(new Set());
  const [editingSubmenu, setEditingSubmenu] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialMenus.length > 0) {
      const processed = processMenuItems(initialMenus);
      setMenuItems(processed);
      setOriginalMenuItems(JSON.parse(JSON.stringify(processed)));
    }
  }, [initialMenus]);

  const processMenuItems = (menus) => {
    let globalPriority = 1;
    
    return menus.map(menu => {
      if (menu.C_SUBMENU && menu.C_SUBMENU.length > 0) {
        const submenuItems = menu.C_SUBMENU.map(submenu => ({
          ...submenu,
          priority: submenu.priority || globalPriority++,
          type: 'submenu',
          parentId: menu.id,
          parentTitle: menu.title
        }));
        
        return {
          id: menu.id,
          title: menu.title,
          href: menu.href,
          type: 'menu_with_submenus',
          submenus: submenuItems.sort((a, b) => a.priority - b.priority),
          priority: null,
          menuOrder: Math.min(...submenuItems.map(s => s.priority))
        };
      } else {
        return {
          id: menu.id,
          title: menu.title,
          href: menu.href,
          type: 'standalone_menu',
          priority: menu.priority || globalPriority++,
          submenus: [],
          menuOrder: menu.priority || globalPriority - 1
        };
      }
    }).sort((a, b) => a.menuOrder - b.menuOrder);
  };

  const toggleMenu = (menuId) => {
    const newExpanded = new Set(expandedMenus);
    if (newExpanded.has(menuId)) {
      newExpanded.delete(menuId);
    } else {
      newExpanded.add(menuId);
    }
    setExpandedMenus(newExpanded);
  };

  const moveMenu = (menuIndex, direction) => {
    const newMenuItems = [...menuItems];
    
    if (direction === 'up' && menuIndex > 0) {
      [newMenuItems[menuIndex], newMenuItems[menuIndex - 1]] = 
      [newMenuItems[menuIndex - 1], newMenuItems[menuIndex]];
    } else if (direction === 'down' && menuIndex < newMenuItems.length - 1) {
      [newMenuItems[menuIndex], newMenuItems[menuIndex + 1]] = 
      [newMenuItems[menuIndex + 1], newMenuItems[menuIndex]];
    } else {
      return;
    }

    let globalPriority = 1;
    newMenuItems.forEach(menu => {
      if (menu.type === 'menu_with_submenus') {
        menu.submenus.forEach(submenu => {
          submenu.priority = globalPriority++;
        });
        menu.menuOrder = Math.min(...menu.submenus.map(s => s.priority));
      } else {
        menu.priority = globalPriority++;
        menu.menuOrder = menu.priority;
      }
    });

    setMenuItems(newMenuItems);
    setHasChanges(true);
  };

  const moveSubmenu = (menuIndex, submenuIndex, direction) => {
    const newMenuItems = [...menuItems];
    const menu = { ...newMenuItems[menuIndex] };
    const newSubmenus = [...menu.submenus];
    
    if (direction === 'up' && submenuIndex > 0) {
      [newSubmenus[submenuIndex], newSubmenus[submenuIndex - 1]] = 
      [newSubmenus[submenuIndex - 1], newSubmenus[submenuIndex]];
    } else if (direction === 'down' && submenuIndex < newSubmenus.length - 1) {
      [newSubmenus[submenuIndex], newSubmenus[submenuIndex + 1]] = 
      [newSubmenus[submenuIndex + 1], newSubmenus[submenuIndex]];
    } else {
      return;
    }

    menu.submenus = newSubmenus;
    newMenuItems[menuIndex] = menu;

    let globalPriority = 1;
    newMenuItems.forEach(menuItem => {
      if (menuItem.type === 'menu_with_submenus') {
        menuItem.submenus.forEach(submenu => {
          submenu.priority = globalPriority++;
        });
        menuItem.menuOrder = Math.min(...menuItem.submenus.map(s => s.priority));
      } else {
        menuItem.priority = globalPriority++;
        menuItem.menuOrder = menuItem.priority;
      }
    });

    setMenuItems(newMenuItems);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const priorityData = [];
      
      menuItems.forEach(menu => {
        if (menu.type === 'menu_with_submenus') {
          menu.submenus.forEach(submenu => {
            priorityData.push({
              menuid: menu.id,
              submenuid: submenu.id,
              priority: submenu.priority
            });
          });
        } else {
          priorityData.push({
            menuid: menu.id,
            submenuid: null,
            priority: menu.priority
          });
        }
      });

      console.log('Saving priority data:', priorityData);
      await onSave(priorityData);
      setOriginalMenuItems(JSON.parse(JSON.stringify(menuItems)));
      setHasChanges(false);
    } catch (error) {
      console.error('Save failed:', error);
      alert('Save failed: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = () => {
    setMenuItems(JSON.parse(JSON.stringify(originalMenuItems)));
    setHasChanges(false);
    setEditingSubmenu(null);
  };

  const handleDiscard = () => {
    setMenuItems(JSON.parse(JSON.stringify(originalMenuItems)));
    setHasChanges(false);
    setEditingSubmenu(null);
  };

  return (
    <div className={styles.alphaContainer}>
      {/* Header */}
      <div className={styles.alphaHeader}>
        <div>
          <h1 className={styles.alphaHeaderTitle}>Menu Priority Settings</h1>
          <p className={styles.alphaHeaderDescription}>
            Arrange menu order. Menus with submenus group together, standalone menus get individual priorities.
          </p>
        </div>
        <div className={styles.alphaHeaderButtons}>
          {hasChanges && (
            <>
              <button
                onClick={handleRestore}
                className={`${styles.alphaButton} ${styles.alphaButtonYellow}`}
              >
                <RotateCcw size={16} />
                Restore
              </button>
              <button
                onClick={handleDiscard}
                className={`${styles.alphaButton} ${styles.alphaButtonGray}`}
              >
                <X size={16} />
                Discard
              </button>
            </>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={`${styles.alphaButton} ${styles.alphaButtonPrimary}`}
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Menu List */}
      <div className={styles.alphaMenuList}>
        {menuItems.map((menu, menuIndex) => (
          <div key={menu.id} className={styles.alphaMenuCard}>
            {/* Menu Header */}
            <div className={styles.alphaMenuHeader}>
              <div className={styles.alphaMenuHeaderLeft}>
                {menu.type === 'menu_with_submenus' && (
                  <button
                    onClick={() => toggleMenu(menu.id)}
                    className={styles.alphaExpandButton}
                  >
                    {expandedMenus.has(menu.id) ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                  </button>
                )}
                
                <div className={styles.alphaMenuInfo}>
                  {menu.type === 'standalone_menu' ? (
                    <span className={`${styles.alphaPriorityBadge} ${styles.alphaPriorityBadgeGreen}`}>
                      {menu.priority}
                    </span>
                  ) : (
                    <span className={`${styles.alphaPriorityBadge} ${styles.alphaPriorityBadgeGray}`}>
                      -
                    </span>
                  )}
                  
                  <div>
                    <span className={styles.alphaMenuTitle}>{menu.title}</span>
                    <div className={styles.alphaBadgeContainer}>
                      {menu.type === 'standalone_menu' ? (
                        <span className={`${styles.alphaBadge} ${styles.alphaBadgeGreen}`}>
                          Standalone Menu
                        </span>
                      ) : (
                        <>
                          <span className={`${styles.alphaBadge} ${styles.alphaBadgePurple}`}>
                            Menu with {menu.submenus.length} submenus
                          </span>
                          {menu.submenus.length > 0 && (
                            <span className={styles.alphaPriorityRange}>
                              Priorities: {Math.min(...menu.submenus.map(s => s.priority))} - {Math.max(...menu.submenus.map(s => s.priority))}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.alphaMenuHeaderRight}>
                {menu.type === 'menu_with_submenus' && menu.submenus.length > 0 && (
                  <button
                    onClick={() => {
                      setEditingSubmenu(editingSubmenu === menu.id ? null : menu.id);
                      setExpandedMenus(prev => new Set([...prev, menu.id]));
                    }}
                    className={styles.alphaArrangeButton}
                  >
                    <Edit2 size={14} />
                    Arrange Submenus
                  </button>
                )}
                
                <div className={styles.alphaArrowButtons}>
                  <button
                    onClick={() => moveMenu(menuIndex, 'up')}
                    disabled={menuIndex === 0}
                    className={styles.alphaArrowButton}
                    title="Move menu up"
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    onClick={() => moveMenu(menuIndex, 'down')}
                    disabled={menuIndex === menuItems.length - 1}
                    className={styles.alphaArrowButton}
                    title="Move menu down"
                  >
                    <ArrowDown size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Submenu List - Show when expanded or editing */}
            {menu.type === 'menu_with_submenus' && 
             (expandedMenus.has(menu.id) || editingSubmenu === menu.id) && (
              <div className={styles.alphaSubmenuContainer}>
                <div className={styles.alphaSubmenuList}>
                  {menu.submenus.map((submenu, submenuIndex) => (
                    <div key={submenu.id} className={styles.alphaSubmenuItem}>
                      <div className={styles.alphaSubmenuLeft}>
                        <span className={`${styles.alphaPriorityBadge} ${styles.alphaPriorityBadgeSubgreen}`}>
                          {submenu.priority}
                        </span>
                        <div>
                          <span className={styles.alphaSubmenuTitle}>{submenu.title}</span>
                          <div className={styles.alphaBadgeContainer}>
                            <span className={`${styles.alphaBadge} ${styles.alphaBadgeSubmenu}`}>
                              Submenu
                            </span>
                          </div>
                        </div>
                      </div>

                      {editingSubmenu === menu.id && (
                        <div className={styles.alphaArrowButtons}>
                          <button
                            onClick={() => moveSubmenu(menuIndex, submenuIndex, 'up')}
                            disabled={submenuIndex === 0}
                            className={styles.alphaArrowButton}
                            title="Move submenu up"
                          >
                            <ArrowUp size={16} />
                          </button>
                          <button
                            onClick={() => moveSubmenu(menuIndex, submenuIndex, 'down')}
                            disabled={submenuIndex === menu.submenus.length - 1}
                            className={styles.alphaArrowButton}
                            title="Move submenu down"
                          >
                            <ArrowDown size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {editingSubmenu === menu.id && (
                  <button
                    onClick={() => setEditingSubmenu(null)}
                    className={styles.alphaDoneButton}
                  >
                    Done Arranging
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {hasChanges && (
        <div className={styles.alphaWarningBox}>
          <div className={styles.alphaWarningContent}>
            <div className={styles.alphaWarningIcon}>⚠️</div>
            <div>
              <p className={styles.alphaWarningTitle}>Unsaved Changes</p>
              <p className={styles.alphaWarningText}>
                Priority numbers will be recalculated. Save to commit changes to database.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrioritySettingComponent;